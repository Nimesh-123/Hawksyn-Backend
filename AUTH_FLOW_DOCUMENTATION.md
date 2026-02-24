# Hawksyn Authentication Flow - Technical Documentation

This document provides all the necessary technical details to implement the **Email + OTP + M-PIN** authentication flow in a Flutter application using **Riverpod**.

## 1. Overview
The flow consists of 3 registration steps and 1 final login step. All registration steps are public and identified by email. The final login step provides a JWT Bearer Token for subsequent authenticated requests.

**Base URL:** `http://localhost:3002/api/v1` (Update to your server IP for physical devices)

---

## 2. API Endpoints

### Step 1: Send OTP
- **URL:** `/user/send-otp`
- **Method:** `POST`
- **Body:** `{ "email": "string" }`
- **Action:** Generates a 4-digit OTP and sends it to the provided email.
- **Validation:** Valid email format required.

### Step 2: Verify OTP
- **URL:** `/user/verify-otp`
- **Method:** `POST`
- **Body:** `{ "email": "string", "otp": "string" }`
- **Action:** Validates the 4-digit OTP. Marks email as verified in the database.
- **Validation:** OTP must be 4 digits.

### Step 3: Set M-PIN
- **URL:** `/user/set-pin`
- **Method:** `POST`
- **Body:** `{ "email": "string", "mPin": "string", "confirmMPin": "string" }`
- **Action:** Hashes the 4-digit PIN and saves it to the user profile.
- **Validation:** PIN must be 4 digits. `mPin` and `confirmMPin` must match.

### Final Step: Login with PIN
- **URL:** `/user/login-with-pin`
- **Method:** `POST`
- **Body:** `{ "email": "string", "mPin": "string" }`
- **Response:**
  ```json
  {
    "success": true,
    "message": "Login successfully",
    "data": {
      "user": {
        "_id": "MONGODB_ID",
        "email": "user@example.com",
        "isEmailVerified": true
      },
      "token": "JWT_BEARER_TOKEN"
    }
  }
  ```

---

## 3. Flutter Implementation Requirements

### Required Packages
- `flutter_riverpod` (State Management)
- `dio` (Networking)
- `flutter_secure_storage` (Token Persistence)

### Implementation Instruction for AI
1.  **Repository Layer**: Create an `AuthRepository` using `Dio`. Implement methods for the 4 endpoints listed above.
2.  **State Management**: Use a `StateNotifierProvider` (Riverpod) to manage the authentication state. The state should handle `initial`, `loading`, `otp_sent`, `otp_verified`, `pin_set`, and `authenticated`.
3.  **Security**:
    - Upon successful login, store the `token` in `FlutterSecureStorage`.
    - Create a global `Provider` for the `Dio` instance that automatically injects the stored token into the `Authorization` header for all protected requests using an Interceptor.
4.  **UI/UX**:
    - Implement a 4-field numeric input for OTP and M-PIN.
    - Implement error handling for invalid OTP or incorrect PIN based on the backend response.

---

## 4. Response Mapping (Data Model)
Map the `data` object from the backend response into a `User` entity and an `AuthResponse` object in Flutter.

```dart
class User {
  final String id;
  final String email;
  final bool isEmailVerified;
  // ... maps to backend fields
}
```
