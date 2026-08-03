import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?
    private var privacyShieldView: UIView?

    func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        guard scene is UIWindowScene else {
            return
        }

        connectionOptions.urlContexts.forEach(forward)
        connectionOptions.userActivities.forEach(forward)
    }

    func sceneWillResignActive(_ scene: UIScene) {
        showPrivacyShield()
    }

    func sceneDidEnterBackground(_ scene: UIScene) {
        showPrivacyShield()
    }

    func sceneWillEnterForeground(_ scene: UIScene) {
        hidePrivacyShield()
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        hidePrivacyShield()
    }

    func sceneDidDisconnect(_ scene: UIScene) {
        hidePrivacyShield()
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        URLContexts.forEach(forward)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        forward(userActivity)
    }

    private func forward(_ context: UIOpenURLContext) {
        var options: [UIApplication.OpenURLOptionsKey: Any] = [
            .openInPlace: context.options.openInPlace,
        ]
        if let sourceApplication = context.options.sourceApplication {
            options[.sourceApplication] = sourceApplication
        }
        if let annotation = context.options.annotation {
            options[.annotation] = annotation
        }

        _ = ApplicationDelegateProxy.shared.application(
            UIApplication.shared,
            open: context.url,
            options: options
        )
    }

    private func forward(_ userActivity: NSUserActivity) {
        _ = ApplicationDelegateProxy.shared.application(
            UIApplication.shared,
            continue: userActivity,
            restorationHandler: { _ in }
        )
    }

    private func showPrivacyShield() {
        guard privacyShieldView == nil, let window else {
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
}
