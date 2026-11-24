import Foundation
import AVFoundation
import QuartzCore

/// Native `AVAudioEngine` Zero-Asset Procedural Synthesizer & 3-Layer Depth Ambient Audio Engine (`iOS-P1-4`).
/// - Uses `.ambient` with `[.mixWithOthers]` so the iOS hardware mute switch silences game audio
///   while allowing players' background music (Apple Music / Spotify) to continue mixing seamlessly.
/// - Handles `AVAudioSession.interruptionNotification` (calls, ads, Siri) and route changes safely.
@MainActor
public final class OceanAudioEngine {
    public static let shared = OceanAudioEngine()

    private let sampleRate: Double = 44100.0
    private let audioFormat = AVAudioFormat(standardFormatWithSampleRate: 44100.0, channels: 1)!

    private let engine = AVAudioEngine()
    private let sfxMixer = AVAudioMixerNode()
    private let ambientMixer = AVAudioMixerNode()

    private struct SfxVoice {
        let player: AVAudioPlayerNode
        let varispeed: AVAudioUnitVarispeed
    }

    private var sfxVoices: [SfxVoice] = []
    private var nextVoiceIndex: Int = 0

    private let ambientShallowPlayer = AVAudioPlayerNode()
    private let ambientTwilightPlayer = AVAudioPlayerNode()
    private let ambientAbyssPlayer = AVAudioPlayerNode()

    private var buffers: [String: AVAudioPCMBuffer] = [:]

    private var isEngineConfigured: Bool = false
    private var isEngineRunning: Bool = false
    private var isMuted: Bool = false
    private var isBackgrounded: Bool = false
    private var isInterrupted: Bool = false
    private var ambientLoopsScheduled: Bool = false

    private var lastBoostPulseTime: TimeInterval = 0
    private var lastRockShatterTime: TimeInterval = 0
    private var lastAmbientUpdateTime: TimeInterval = 0
    private var lastUiTickTime: TimeInterval = 0
    private var lastWheelTickTime: TimeInterval = 0
    private var lastHitTime: TimeInterval = 0

    private var observers: [NSObjectProtocol] = []

    private init() {
        registerSessionObservers()
    }

    // MARK: - Lifecycle & Audio Session Compliance

    private func registerSessionObservers() {
        let nc = NotificationCenter.default

        let interruptionObs = nc.addObserver(
            forName: AVAudioSession.interruptionNotification,
            object: AVAudioSession.sharedInstance(),
            queue: .main
        ) { [weak self] notification in
            let typeRaw = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt
            let optionsRaw = notification.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
            Task { @MainActor [weak self] in
                guard let self = self, let typeRaw = typeRaw,
                      let type = AVAudioSession.InterruptionType(rawValue: typeRaw) else { return }
                switch type {
                case .began:
                    self.isInterrupted = true
                    self.pauseEngineInternal()
                case .ended:
                    self.isInterrupted = false
                    let options = AVAudioSession.InterruptionOptions(rawValue: optionsRaw)
                    if options.contains(.shouldResume) || !self.isBackgrounded {
                        self.resumeEngineIfAllowed()
                    }
                @unknown default:
                    break
                }
            }
        }
        observers.append(interruptionObs)

        let routeObs = nc.addObserver(
            forName: AVAudioSession.routeChangeNotification,
            object: AVAudioSession.sharedInstance(),
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.resumeEngineIfAllowed()
            }
        }
        observers.append(routeObs)

        let configObs = nc.addObserver(
            forName: .AVAudioEngineConfigurationChange,
            object: engine,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self = self else { return }
                self.isEngineRunning = false
                self.ambientLoopsScheduled = false
                self.resumeEngineIfAllowed()
            }
        }
        observers.append(configObs)
    }

    public func setMuted(_ muted: Bool) {
        isMuted = muted
        if muted {
            pauseEngineInternal()
        } else {
            resumeEngineIfAllowed()
        }
    }

    public func handleAppBackgrounded() {
        isBackgrounded = true
        pauseEngineInternal()
    }

    public func handleAppForegrounded(soundEnabled: Bool) {
        isBackgrounded = false
        isMuted = !soundEnabled
        isInterrupted = false
        if !isMuted {
            resumeEngineIfAllowed()
        }
    }

    private func pauseEngineInternal() {
        guard isEngineConfigured else { return }
        ambientShallowPlayer.pause()
        ambientTwilightPlayer.pause()
        ambientAbyssPlayer.pause()
        for v in sfxVoices {
            v.player.stop()
        }
        if engine.isRunning {
            engine.pause()
        }
        isEngineRunning = false
        ambientLoopsScheduled = false
    }

    private func resumeEngineIfAllowed() {
        guard !isMuted && !isBackgrounded && !isInterrupted else { return }
        _ = ensureEngineRunning()
    }

    @discardableResult
    private func ensureEngineRunning() -> Bool {
        guard !isMuted && !isBackgrounded && !isInterrupted else { return false }

        if !isEngineConfigured {
            configureAudioGraphAndBuffers()
        }

        if engine.isRunning {
            isEngineRunning = true
            return true
        }

        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.ambient, mode: .default, options: [.mixWithOthers])
            try session.setActive(true)
            engine.prepare()
            try engine.start()
            isEngineRunning = true
            return true
        } catch {
            isEngineRunning = false
            return false
        }
    }

    private func configureAudioGraphAndBuffers() {
        guard !isEngineConfigured else { return }

        engine.attach(sfxMixer)
        engine.attach(ambientMixer)
        sfxMixer.outputVolume = 0.92
        ambientMixer.outputVolume = 0.72

        engine.connect(sfxMixer, to: engine.mainMixerNode, format: audioFormat)
        engine.connect(ambientMixer, to: engine.mainMixerNode, format: audioFormat)

        sfxVoices.removeAll()
        for _ in 0..<6 {
            let player = AVAudioPlayerNode()
            let varispeed = AVAudioUnitVarispeed()
            varispeed.rate = 1.0
            engine.attach(player)
            engine.attach(varispeed)
            engine.connect(player, to: varispeed, format: audioFormat)
            engine.connect(varispeed, to: sfxMixer, format: audioFormat)
            sfxVoices.append(SfxVoice(player: player, varispeed: varispeed))
        }

        for ambPlayer in [ambientShallowPlayer, ambientTwilightPlayer, ambientAbyssPlayer] {
            ambPlayer.volume = 0.0
            engine.attach(ambPlayer)
            engine.connect(ambPlayer, to: ambientMixer, format: audioFormat)
        }

        synthesizeAllBuffers()
        isEngineConfigured = true
    }

    private func startAmbientLoopsIfNeeded() {
        guard isEngineRunning && !ambientLoopsScheduled else { return }
        scheduleLoop(ambientShallowPlayer, key: "amb_shallow")
        scheduleLoop(ambientTwilightPlayer, key: "amb_twilight")
        scheduleLoop(ambientAbyssPlayer, key: "amb_abyss")
        ambientLoopsScheduled = true
    }

    private func pauseAmbientLoops() {
        guard isEngineConfigured else { return }
        ambientShallowPlayer.volume = 0.0
        ambientTwilightPlayer.volume = 0.0
        ambientAbyssPlayer.volume = 0.0
        if ambientLoopsScheduled {
            ambientShallowPlayer.pause()
            ambientTwilightPlayer.pause()
            ambientAbyssPlayer.pause()
            ambientLoopsScheduled = false
        }
    }

    private func scheduleLoop(_ player: AVAudioPlayerNode, key: String) {
        guard let buf = buffers[key] else { return }
        player.stop()
        player.scheduleBuffer(buf, at: nil, options: .loops, completionHandler: nil)
        if engine.isRunning {
            player.play()
        }
    }

    // MARK: - 3-Layer Depth-Reactive Ocean Ambient Mixer

    /// Updates crossfade gain of shallow / twilight / abyss ocean beds (~10Hz throttled).
    /// Completely silent on the Title screen, Loading screen, Atlas modal, and Pause screen so there is ZERO idle hum.
    public func updateAmbientDepth(worldY: Double, isPlaying: Bool, isPaused: Bool) {
        if !isPlaying || isPaused || isMuted || isBackgrounded || isInterrupted {
            pauseAmbientLoops()
            return
        }
        let now = CACurrentMediaTime()
        guard now - lastAmbientUpdateTime >= 0.095 else { return }
        lastAmbientUpdateTime = now

        guard ensureEngineRunning() else { return }
        startAmbientLoopsIfNeeded()

        let depthM = GameRules.worldYToMeterDepth(max(0.0, worldY))
        let shallowWeight = max(0.0, min(1.0, 1.0 - max(0.0, depthM - 160.0) / 480.0))
        let abyssWeight = max(0.0, min(1.0, (depthM - 750.0) / 1100.0))
        let twilightWeight = max(0.0, min(1.0, 1.0 - shallowWeight - abyssWeight))

        let masterBedScale = 0.14
        ambientShallowPlayer.volume = Float(shallowWeight * masterBedScale)
        ambientTwilightPlayer.volume = Float(twilightWeight * masterBedScale * 0.95)
        ambientAbyssPlayer.volume = Float(abyssWeight * masterBedScale * 0.90)
    }

    // MARK: - Gameplay & UI Sound Effects

    public func playBite(tier: Int, combo: Int) {
        let clampedTier = max(1, min(8, tier))
        let key = clampedTier >= 4 ? "bite_heavy" : "bite_light"
        // Combo pitch climb mirrors escalating hunting excitement (+4% per stack, capped at +36%)
        let comboPitch = Float(1.0 + Double(min(9, max(0, combo))) * 0.04)
        let jitter = Float.random(in: 0.97...1.03)
        playBuffer(key: key, volume: 0.85, rate: comboPitch * jitter)
    }

    public func playBoostPulse() {
        let now = CACurrentMediaTime()
        guard now - lastBoostPulseTime >= 0.11 else { return }
        lastBoostPulseTime = now
        playBuffer(key: "boost_pulse", volume: 0.42, rate: Float.random(in: 0.96...1.06))
    }

    public func playArmorCrush(broken: Bool) {
        if broken {
            playBuffer(key: "armor_crush", volume: 0.95, rate: 1.0)
        } else {
            playBuffer(key: "armor_crack", volume: 0.80, rate: Float.random(in: 0.95...1.05))
        }
    }

    public func playRockShatter() {
        let now = CACurrentMediaTime()
        guard now - lastRockShatterTime >= 0.13 else { return }
        lastRockShatterTime = now
        playBuffer(key: "rock_shatter", volume: 0.95, rate: Float.random(in: 0.93...1.05))
    }

    public func playHit() {
        let now = CACurrentMediaTime()
        guard now - lastHitTime >= 0.12 else { return }
        lastHitTime = now
        playBuffer(key: "hit", volume: 0.92, rate: 1.0)
    }

    public func playCoin(isGene: Bool = false) {
        playBuffer(key: isGene ? "gene" : "coin", volume: 0.68, rate: Float.random(in: 0.98...1.04))
    }

    public func playEvolution() {
        playBuffer(key: "evolution", volume: 0.95, rate: 1.0)
    }

    public func playFrenzy() {
        playBuffer(key: "frenzy", volume: 0.96, rate: 1.0)
    }

    public func playUiTick() {
        let now = CACurrentMediaTime()
        guard now - lastUiTickTime >= 0.025 else { return }
        lastUiTickTime = now
        playBuffer(key: "ui_tick", volume: 0.46, rate: 1.0)
    }

    public func playWheelDetentTick(speedRatio: Double = 0.0) {
        let now = CACurrentMediaTime()
        guard now - lastWheelTickTime >= 0.022 else { return }
        lastWheelTickTime = now
        let rate = Float(0.95 + min(1.0, max(0.0, speedRatio)) * 0.25)
        playBuffer(key: "wheel_detent", volume: 0.36, rate: rate)
    }

    private func playBuffer(key: String, volume: Float, rate: Float) {
        guard !isMuted && !isBackgrounded && !isInterrupted else { return }
        guard ensureEngineRunning(), let buf = buffers[key], !sfxVoices.isEmpty else { return }

        var chosenIndex = nextVoiceIndex
        for offset in 0..<sfxVoices.count {
            let idx = (nextVoiceIndex + offset) % sfxVoices.count
            if !sfxVoices[idx].player.isPlaying {
                chosenIndex = idx
                break
            }
        }
        nextVoiceIndex = (chosenIndex + 1) % sfxVoices.count

        let voice = sfxVoices[chosenIndex]
        voice.player.stop()
        voice.varispeed.rate = max(0.5, min(2.0, rate))
        voice.player.volume = max(0.0, min(1.0, volume))
        voice.player.scheduleBuffer(buf, at: nil, options: .interrupts, completionHandler: nil)
        if engine.isRunning {
            voice.player.play()
        }
    }

    // MARK: - Procedural Waveform Synthesis (1:1 Parity with Web audio.ts + Native Depth Beds)

    private func synthesizeAllBuffers() {
        buffers["bite_light"] = makeBiteBuffer(startHz: 290.0, endHz: 55.0, popStartHz: 460.0)
        buffers["bite_heavy"] = makeBiteBuffer(startHz: 185.0, endHz: 46.0, popStartHz: 360.0)
        buffers["boost_pulse"] = makeBoostPulseBuffer()
        buffers["armor_crack"] = makeArmorBuffer(broken: false)
        buffers["armor_crush"] = makeArmorBuffer(broken: true)
        buffers["rock_shatter"] = makeRockShatterBuffer()
        buffers["hit"] = makeHitBuffer()
        buffers["coin"] = makeDualChimeBuffer(f1: 880.0, f2: 1318.5, duration: 0.16)
        buffers["gene"] = makeDualChimeBuffer(f1: 1046.5, f2: 1567.98, duration: 0.19)
        buffers["evolution"] = makeArpeggioBuffer(notes: [261.63, 329.63, 392.0, 523.25, 659.25], stagger: 0.055, noteDur: 0.24)
        buffers["frenzy"] = makeArpeggioBuffer(notes: [392.0, 493.88, 587.33, 783.99, 987.77], stagger: 0.042, noteDur: 0.26)
        buffers["ui_tick"] = makeSweepBuffer(duration: 0.036, startHz: 780.0, endHz: 420.0, peakAmp: 0.28, isTriangle: false)
        buffers["wheel_detent"] = makeSweepBuffer(duration: 0.018, startHz: 1120.0, endHz: 340.0, peakAmp: 0.22, isTriangle: true)

        // Seamless 4.0-second filtered underwater current beds (zero low-frequency sine oscillator hum!)
        buffers["amb_shallow"] = makeAmbientBedBuffer(
            duration: 4.0,
            lowCutHz: 240.0,
            highCutHz: 780.0,
            swellHz: 0.5,
            shimmerDepth: 0.28,
            seed: 0x1029_3847
        )
        buffers["amb_twilight"] = makeAmbientBedBuffer(
            duration: 4.0,
            lowCutHz: 190.0,
            highCutHz: 540.0,
            swellHz: 0.25,
            shimmerDepth: 0.34,
            seed: 0x5678_1234
        )
        buffers["amb_abyss"] = makeAmbientBedBuffer(
            duration: 4.0,
            lowCutHz: 160.0,
            highCutHz: 390.0,
            swellHz: 0.25,
            shimmerDepth: 0.38,
            seed: 0x9ABC_DEF1
        )
    }

    private func allocateBuffer(duration: Double) -> AVAudioPCMBuffer? {
        let frameCount = AVAudioFrameCount(max(1, Int((duration * sampleRate).rounded())))
        guard let buf = AVAudioPCMBuffer(pcmFormat: audioFormat, frameCapacity: frameCount) else {
            return nil
        }
        buf.frameLength = frameCount
        return buf
    }

    private func triWave(_ phase: Double) -> Double {
        let p = phase - floor(phase)
        return 1.0 - 4.0 * abs(p - 0.5)
    }

    private func sawWave(_ phase: Double) -> Double {
        let p = phase - floor(phase)
        return 2.0 * p - 1.0
    }

    private func makeBiteBuffer(startHz: Double, endHz: Double, popStartHz: Double) -> AVAudioPCMBuffer? {
        let duration = 0.145
        guard let buf = allocateBuffer(duration: duration), let ch = buf.floatChannelData?[0] else { return nil }
        let n = Int(buf.frameLength)
        var crunchPhase = 0.0
        var popPhase = 0.0
        for i in 0..<n {
            let t = Double(i) / sampleRate
            let prog = min(1.0, t / 0.14)
            let crunchHz = startHz * pow(endHz / startHz, prog)
            crunchPhase += crunchHz / sampleRate
            let crunchEnv = max(0.0, exp(-t * 28.0))

            var popSample = 0.0
            if t < 0.10 {
                let pProg = t / 0.10
                let popHz = popStartHz * pow(980.0 / popStartHz, pProg)
                popPhase += popHz / sampleRate
                let popEnv = exp(-t * 36.0)
                popSample = sin(2.0 * .pi * popPhase) * popEnv * 0.26
            }
            let sample = triWave(crunchPhase) * crunchEnv * 0.42 + popSample
            ch[i] = Float(max(-0.95, min(0.95, sample)))
        }
        return buf
    }

    private func makeBoostPulseBuffer() -> AVAudioPCMBuffer? {
        let duration = 0.10
        guard let buf = allocateBuffer(duration: duration), let ch = buf.floatChannelData?[0] else { return nil }
        let n = Int(buf.frameLength)
        var phase = 0.0
        var noiseSeed: UInt32 = 0x9E37_79B9
        for i in 0..<n {
            let t = Double(i) / sampleRate
            let prog = min(1.0, t / 0.09)
            let hz = 190.0 * pow(350.0 / 190.0, prog)
            phase += hz / sampleRate
            noiseSeed = noiseSeed &* 1664525 &+ 1013904223
            let white = (Double(noiseSeed & 0xFFFF) / 32768.0) - 1.0
            let env = sin(.pi * min(1.0, t / duration)) * exp(-t * 14.0)
            let sample = (sin(2.0 * .pi * phase) * 0.55 + white * 0.18) * env * 0.34
            ch[i] = Float(max(-0.95, min(0.95, sample)))
        }
        return buf
    }

    private func makeArmorBuffer(broken: Bool) -> AVAudioPCMBuffer? {
        let duration = broken ? 0.23 : 0.14
        guard let buf = allocateBuffer(duration: duration), let ch = buf.floatChannelData?[0] else { return nil }
        let n = Int(buf.frameLength)
        var clangPhase = 0.0
        var modPhase = 0.0
        var subPhase = 0.0
        for i in 0..<n {
            let t = Double(i) / sampleRate
            let prog = min(1.0, t / duration)
            let clangHz = (broken ? 520.0 : 660.0) * pow(0.32, prog)
            clangPhase += clangHz / sampleRate
            modPhase += (clangHz * 1.41) / sampleRate
            let fmClang = sin(2.0 * .pi * clangPhase + sin(2.0 * .pi * modPhase) * 2.1) * exp(-t * 24.0) * 0.38

            var sub = 0.0
            if broken {
                let subHz = 135.0 * pow(38.0 / 135.0, prog)
                subPhase += subHz / sampleRate
                sub = triWave(subPhase) * exp(-t * 15.0) * 0.44
            }
            ch[i] = Float(max(-0.95, min(0.95, fmClang + sub)))
        }
        return buf
    }

    private func makeRockShatterBuffer() -> AVAudioPCMBuffer? {
        let duration = 0.27
        guard let buf = allocateBuffer(duration: duration), let ch = buf.floatChannelData?[0] else { return nil }
        let n = Int(buf.frameLength)
        var subPhase = 0.0
        var crackPhase = 0.0
        var noiseSeed: UInt32 = 0x5A17_C4A1
        for i in 0..<n {
            let t = Double(i) / sampleRate
            let subHz = 118.0 * pow(34.0 / 118.0, min(1.0, t / 0.25))
            subPhase += subHz / sampleRate
            let subEnv = exp(-t * 13.5)

            var crack = 0.0
            if t < 0.16 {
                let crackHz = 340.0 * pow(88.0 / 340.0, t / 0.15)
                crackPhase += crackHz / sampleRate
                crack = triWave(crackPhase) * exp(-t * 26.0) * 0.30
            }

            noiseSeed = noiseSeed &* 1664525 &+ 1013904223
            let rumbleNoise = ((Double(noiseSeed & 0xFFFF) / 32768.0) - 1.0) * exp(-t * 22.0) * 0.16
            let sample = sawWave(subPhase) * subEnv * 0.36 + crack + rumbleNoise
            ch[i] = Float(max(-0.95, min(0.95, sample)))
        }
        return buf
    }

    private func makeHitBuffer() -> AVAudioPCMBuffer? {
        let duration = 0.26
        guard let buf = allocateBuffer(duration: duration), let ch = buf.floatChannelData?[0] else { return nil }
        let n = Int(buf.frameLength)
        var phase = 0.0
        for i in 0..<n {
            let t = Double(i) / sampleRate
            let hz = 165.0 * pow(72.0 / 165.0, min(1.0, t / 0.24))
            phase += hz / sampleRate
            let env = exp(-t * 12.0)
            ch[i] = Float(max(-0.95, min(0.95, sawWave(phase) * env * 0.34)))
        }
        return buf
    }

    private func makeDualChimeBuffer(f1: Double, f2: Double, duration: Double) -> AVAudioPCMBuffer? {
        guard let buf = allocateBuffer(duration: duration), let ch = buf.floatChannelData?[0] else { return nil }
        let n = Int(buf.frameLength)
        var p1 = 0.0
        var p2 = 0.0
        for i in 0..<n {
            let t = Double(i) / sampleRate
            p1 += f1 / sampleRate
            p2 += f2 / sampleRate
            let e1 = exp(-t * 20.0)
            let e2 = t >= 0.04 ? exp(-(t - 0.04) * 22.0) : 0.0
            let sample = sin(2.0 * .pi * p1) * e1 * 0.24 + sin(2.0 * .pi * p2) * e2 * 0.24
            ch[i] = Float(max(-0.95, min(0.95, sample)))
        }
        return buf
    }

    private func makeArpeggioBuffer(notes: [Double], stagger: Double, noteDur: Double) -> AVAudioPCMBuffer? {
        let totalDur = Double(max(0, notes.count - 1)) * stagger + noteDur + 0.02
        guard let buf = allocateBuffer(duration: totalDur), let ch = buf.floatChannelData?[0] else { return nil }
        let n = Int(buf.frameLength)
        for i in 0..<n {
            let t = Double(i) / sampleRate
            var mix = 0.0
            for (idx, freq) in notes.enumerated() {
                let start = Double(idx) * stagger
                if t >= start && t <= start + noteDur {
                    let localT = t - start
                    let env = min(1.0, localT / 0.01) * exp(-localT * 12.0)
                    mix += triWave(freq * localT) * env * 0.18
                }
            }
            ch[i] = Float(max(-0.95, min(0.95, mix)))
        }
        return buf
    }

    private func makeSweepBuffer(duration: Double, startHz: Double, endHz: Double, peakAmp: Double, isTriangle: Bool) -> AVAudioPCMBuffer? {
        guard let buf = allocateBuffer(duration: duration), let ch = buf.floatChannelData?[0] else { return nil }
        let n = Int(buf.frameLength)
        var phase = 0.0
        for i in 0..<n {
            let t = Double(i) / sampleRate
            let hz = startHz * pow(endHz / startHz, min(1.0, t / duration))
            phase += hz / sampleRate
            let env = min(1.0, t / 0.003) * exp(-t * (4.5 / duration))
            let wave = isTriangle ? triWave(phase) : sin(2.0 * .pi * phase)
            ch[i] = Float(max(-0.95, min(0.95, wave * env * peakAmp)))
        }
        return buf
    }

    /// Generates a seamless band-limited underwater water-current bed (no low-frequency sine drone hum).
    private func makeAmbientBedBuffer(
        duration: Double,
        lowCutHz: Double,
        highCutHz: Double,
        swellHz: Double,
        shimmerDepth: Double,
        seed: UInt32
    ) -> AVAudioPCMBuffer? {
        guard let buf = allocateBuffer(duration: duration), let ch = buf.floatChannelData?[0] else { return nil }
        let n = Int(buf.frameLength)
        let exactDur = Double(n) / sampleRate
        let lfoF = max(1.0, (swellHz * exactDur).rounded()) / exactDur
        let dt = 1.0 / sampleRate
        let hpRc = 1.0 / (2.0 * .pi * lowCutHz)
        let hpAlpha = hpRc / (hpRc + dt)
        let lpRc = 1.0 / (2.0 * .pi * highCutHz)
        let lpAlpha = dt / (lpRc + dt)

        var raw = [Double](repeating: 0.0, count: n)
        var rng = seed
        var prevX = 0.0
        var hpY = 0.0
        var lp1 = 0.0
        var lp2 = 0.0

        // Warm up filters with 0.25s preroll so start/end match smoothly
        let warmup = Int(sampleRate * 0.25)
        for idx in 0..<(n + warmup) {
            rng = rng &* 1664525 &+ 1013904223
            let white = (Double(rng >> 16) / 32768.0) - 1.0
            hpY = hpAlpha * (hpY + white - prevX)
            prevX = white
            lp1 += lpAlpha * (hpY - lp1)
            lp2 += lpAlpha * (lp1 - lp2)
            if idx >= warmup {
                let sampleIdx = idx - warmup
                let t = Double(sampleIdx) / sampleRate
                let swell = 0.74 + shimmerDepth * (0.5 + 0.5 * sin(2.0 * .pi * lfoF * t))
                raw[sampleIdx] = lp2 * swell * 0.65
            }
        }

        // Crossfade 0.25s seam window with raised-cosine weights for click-free infinite looping
        let fadeLen = min(n / 4, Int(sampleRate * 0.25))
        for i in 0..<fadeLen {
            let w = 0.5 - 0.5 * cos(.pi * Double(i) / Double(fadeLen))
            let tailIdx = n - fadeLen + i
            let blended = raw[tailIdx] * (1.0 - w) + raw[i] * w
            raw[i] = blended
        }

        for i in 0..<n {
            ch[i] = Float(max(-0.45, min(0.45, raw[i])))
        }
        return buf
    }
}
