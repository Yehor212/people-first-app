import Capacitor
import UIKit

@objc(StatusBarStylePlugin)
public class StatusBarStylePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "StatusBarStylePlugin"
    public let jsName = "StatusBarStyle"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setStyle", returnType: CAPPluginReturnPromise)
    ]

    @objc func setStyle(_ call: CAPPluginCall) {
        let requestedStyle = call.getString("style") ?? "DEFAULT"

        DispatchQueue.main.async {
            guard let controller = self.bridge?.viewController as? BridgeViewController else {
                call.reject("ZenFlow view controller is not available")
                return
            }

            let style: UIStatusBarStyle
            switch requestedStyle {
            case "DARK":
                style = .lightContent
            case "LIGHT":
                if #available(iOS 13.0, *) {
                    style = .darkContent
                } else {
                    style = .default
                }
            default:
                style = .default
            }

            controller.updateStatusBarStyle(style)
            call.resolve()
        }
    }
}
