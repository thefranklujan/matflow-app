import UIKit
import Capacitor
import OneSignalFramework

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, OSNotificationClickListener {

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

        // Intercept notification clicks so we can route the user to the relevant
        // in-app screen instead of opening Safari.
        OneSignal.Notifications.addClickListener(self)

        return true
    }

    // MARK: - OSNotificationClickListener

    func onClick(event: OSNotificationClickEvent) {
        // Prefer launchURL (set by server push `url` field) — it's an absolute
        // https URL pointing at app.mymatflow.com. Load it into the Capacitor
        // webview so the user stays inside the app.
        if let launchURL = event.result.url, let url = URL(string: launchURL),
           let vc = window?.rootViewController as? CAPBridgeViewController {
            DispatchQueue.main.async {
                vc.webView?.load(URLRequest(url: url))
            }
        }
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
