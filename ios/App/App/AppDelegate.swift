import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    private var privacyShieldView: UIView?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        showPrivacyShield()
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        hidePrivacyShield()
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        hidePrivacyShield()
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    private func currentWindow() -> UIWindow? {
        if let window = self.window {
            return window
        }

        return UIApplication.shared.connectedScenes
            .compactMap { scene in
                (scene as? UIWindowScene)?.windows.first { $0.isKeyWindow }
            }
            .first
    }

    private func showPrivacyShield() {
        guard privacyShieldView == nil, let window = currentWindow() else {
            return
        }

        let shield = UIVisualEffectView(effect: UIBlurEffect(style: .systemUltraThinMaterialDark))
        shield.frame = window.bounds
        shield.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        shield.isUserInteractionEnabled = false
        window.addSubview(shield)
        privacyShieldView = shield
    }

    private func hidePrivacyShield() {
        privacyShieldView?.removeFromSuperview()
        privacyShieldView = nil
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
