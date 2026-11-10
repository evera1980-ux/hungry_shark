import SwiftUI
import UIKit

final class AppDelegate: NSObject, UIApplicationDelegate {
    static var orientationLock = UIInterfaceOrientationMask.landscape

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        // Ensure system UIWindow background matches LaunchBg (#061528) so there is zero black flash
        let abyssalBg = UIColor(red: 6/255, green: 21/255, blue: 40/255, alpha: 1.0)
        UIWindow.appearance().backgroundColor = abyssalBg
        return true
    }

    func application(
        _ application: UIApplication,
        supportedInterfaceOrientationsFor window: UIWindow?
    ) -> UIInterfaceOrientationMask {
        return AppDelegate.orientationLock
    }
}

@main
struct HungrySharkEvolutionApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    init() {
        GADInfoPlistRuntimePatch.installIfNeeded()
        UIWindow.appearance().backgroundColor = UIColor(red: 6/255, green: 21/255, blue: 40/255, alpha: 1.0)
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .preferredColorScheme(.dark)
        }
    }
}
