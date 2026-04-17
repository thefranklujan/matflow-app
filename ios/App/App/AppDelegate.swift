import UIKit
import Capacitor
import OneSignalFramework

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // OneSignal native iOS push — real APNs, real reliability.
        OneSignal.Debug.setLogLevel(.LL_VERBOSE)
        OneSignal.initialize("ca291bda-c85e-4be3-9127-599c362268d9", withLaunchOptions: launchOptions)

        // Ask for permission up-front. iOS shows the native prompt exactly once;
        // subsequent calls are no-ops.
        OneSignal.Notifications.requestPermission({ accepted in
            print("MatFlow push permission: \(accepted)")
        }, fallbackToSettings: true)

        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {}
    func applicationDidEnterBackground(_ application: UIApplication) {}
    func applicationWillEnterForeground(_ application: UIApplication) {}
    func applicationDidBecomeActive(_ application: UIApplication) {}
    func applicationWillTerminate(_ application: UIApplication) {}

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
}
