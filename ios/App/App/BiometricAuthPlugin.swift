import Capacitor
import Foundation
import LocalAuthentication

@objc(BiometricAuthPlugin)
public class BiometricAuthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BiometricAuthPlugin"
    public let jsName = "BiometricAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "authenticate", returnType: CAPPluginReturnPromise)
    ]

    @objc func isAvailable(_ call: CAPPluginCall) {
        let context = LAContext()
        var authError: NSError?
        let available = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &authError)

        var payload: [String: Any] = ["available": available]
        if available {
            payload["type"] = biometricType(for: context.biometryType)
        } else if let authError = authError {
            payload["error"] = authError.localizedDescription
        }

        call.resolve(payload)
    }

    @objc func authenticate(_ call: CAPPluginCall) {
        let reason = call.getString("reason") ?? "Unlock your diary"
        let context = LAContext()
        var authError: NSError?

        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &authError) else {
            call.resolve([
                "success": false,
                "error": authError?.localizedDescription ?? "Biometric authentication is not available"
            ])
            return
        }

        context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason) { success, error in
            DispatchQueue.main.async {
                if success {
                    call.resolve(["success": true])
                } else {
                    call.resolve([
                        "success": false,
                        "error": error?.localizedDescription ?? "Biometric authentication failed"
                    ])
                }
            }
        }
    }

    private func biometricType(for type: LABiometryType) -> String {
        switch type {
        case .faceID:
            return "face"
        case .touchID:
            return "fingerprint"
        default:
            return "multiple"
        }
    }
}
