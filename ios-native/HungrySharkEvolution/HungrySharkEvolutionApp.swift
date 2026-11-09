import SwiftUI

@main
struct HungrySharkEvolutionApp: App {
    init() {
        GADInfoPlistRuntimePatch.installIfNeeded()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .preferredColorScheme(.dark)
        }
    }
}
