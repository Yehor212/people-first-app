import Capacitor
import Foundation
import LocalAuthentication
import Security

@objc(BiometricAuthPlugin)
public class BiometricAuthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BiometricAuthPlugin"
    public let jsName = "BiometricAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "enroll", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "unenroll", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "authenticate", returnType: CAPPluginReturnPromise)
    ]

    private let credentialService = "app.zenflow.diary.biometric"
    private let credentialAccount = "diary-unlock"

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

    @objc func enroll(_ call: CAPPluginCall) {
        let reason = call.getString("reason") ?? "Enable biometric diary unlock"
        let context = LAContext()
        var authError: NSError?

        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &authError) else {
            call.resolve([
                "success": false,
                "error": authError?.localizedDescription ?? "Biometric authentication is not available"
            ])
            return
        }

        guard let secret = call.getString("secret"), !secret.isEmpty else {
            call.resolve([
                "success": false,
                "error": "Biometric diary unlock needs an unlocked journal key."
            ])
            return
        }

        DispatchQueue.global(qos: .userInitiated).async {
            let result = self.replaceKeychainCredential(secret: secret, reason: reason)
            self.resolveKeychainResult(call, result: result)
        }
    }

    @objc func unenroll(_ call: CAPPluginCall) {
        DispatchQueue.global(qos: .userInitiated).async {
            let status = SecItemDelete(self.baseCredentialQuery() as CFDictionary)
            DispatchQueue.main.async {
                if status == errSecSuccess || status == errSecItemNotFound {
                    call.resolve(["success": true])
                    return
                }

                call.resolve([
                    "success": false,
                    "error": self.keychainErrorMessage(status)
                ])
            }
        }
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

        DispatchQueue.global(qos: .userInitiated).async {
            let result = self.readKeychainCredential(reason: reason)
            self.resolveKeychainResult(call, result: result)
        }
    }

    private func replaceKeychainCredential(secret: String, reason: String) -> Result<String, Error> {
        do {
            SecItemDelete(baseCredentialQuery() as CFDictionary)

            var addQuery = try baseProtectedCredentialQuery()
            addQuery[kSecValueData as String] = Data(secret.utf8)

            let status = SecItemAdd(addQuery as CFDictionary, nil)
            guard status == errSecSuccess else {
                throw keychainError(status)
            }

            return readKeychainCredential(reason: reason)
        } catch {
            return .failure(error)
        }
    }

    private func readKeychainCredential(reason: String) -> Result<String, Error> {
        let authenticationContext = LAContext()
        authenticationContext.localizedReason = reason

        var query = baseCredentialQuery()
        query[kSecReturnData as String] = kCFBooleanTrue
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        query[kSecUseAuthenticationContext as String] = authenticationContext

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess else {
            return .failure(keychainError(status))
        }

        guard let data = item as? Data,
              let secret = String(data: data, encoding: .utf8),
              !secret.isEmpty else {
            return .failure(keychainError(errSecAuthFailed))
        }

        return .success(secret)
    }

    private func baseCredentialQuery() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: credentialService,
            kSecAttrAccount as String: credentialAccount
        ]
    }

    private func baseProtectedCredentialQuery() throws -> [String: Any] {
        var error: Unmanaged<CFError>?
        guard let accessControl = SecAccessControlCreateWithFlags(
            nil,
            kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            .biometryCurrentSet,
            &error
        ) else {
            throw error?.takeRetainedValue() ?? keychainError(errSecParam)
        }

        var query = baseCredentialQuery()
        query[kSecAttrAccessControl as String] = accessControl
        return query
    }

    private func resolveKeychainResult(_ call: CAPPluginCall, result: Result<String, Error>) {
        DispatchQueue.main.async {
            switch result {
            case .success(let secret):
                call.resolve(["success": true, "secret": secret])
            case .failure(let error):
                call.resolve([
                    "success": false,
                    "error": self.keychainErrorMessage(error)
                ])
            }
        }
    }

    private func keychainError(_ status: OSStatus) -> NSError {
        NSError(
            domain: NSOSStatusErrorDomain,
            code: Int(status),
            userInfo: [NSLocalizedDescriptionKey: keychainErrorMessage(status)]
        )
    }

    private func keychainErrorMessage(_ error: Error) -> String {
        let nsError = error as NSError
        if nsError.domain == NSOSStatusErrorDomain {
            return keychainErrorMessage(OSStatus(nsError.code))
        }

        return error.localizedDescription
    }

    private func keychainErrorMessage(_ status: OSStatus) -> String {
        switch status {
        case errSecItemNotFound:
            return "Biometric diary unlock is not enrolled. Unlock with your password and enable biometrics again."
        case errSecUserCanceled:
            return "Biometric authentication was canceled."
        case errSecAuthFailed:
            return "Biometric authentication failed."
        case errSecInteractionNotAllowed:
            return "Biometric authentication is not available while the app is inactive."
        default:
            return SecCopyErrorMessageString(status, nil) as String? ?? "Biometric authentication failed."
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
