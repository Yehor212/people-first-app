import Capacitor
import UIKit

class BridgeViewController: CAPBridgeViewController {
    private var zenflowStatusBarStyle: UIStatusBarStyle = .default

    override var preferredStatusBarStyle: UIStatusBarStyle {
        zenflowStatusBarStyle
    }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(BiometricAuthPlugin())
        bridge?.registerPluginInstance(StatusBarStylePlugin())
    }

    func updateStatusBarStyle(_ style: UIStatusBarStyle) {
        zenflowStatusBarStyle = style
        setNeedsStatusBarAppearanceUpdate()
    }
}
