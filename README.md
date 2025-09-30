## Privacy-preserving face recognition

### The flow of the system

Client side:

- User upload a photo of their face
- The photo is anonymized on device (eigenface, k-same pixel, noise, etc.)
  - https://github.com/TechStark/opencv-js
  - https://github.com/justadudewhohacks/face-api.js
  - https://www.npmjs.com/package/ml-pca
- The anonymized photo is sent to the server

Passwordless authentication:

https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API
https://simplewebauthn.dev/docs/

- User upload a photo of their face
- The photo is anonymized on device (eigenface, k-same pixel, noise, etc.)
- The anonymized photo is sent to the server
- The server matches the anonymized photo with the one in the database
- If the photo is matched, the server returns a one-time password (OTP) to the user via email or SMS
- The OTP is valid for a short period of time (e.g., 5 minutes)
- The user uses the OTP to log in to the system

Server side:

- With face recognition model, the server matches the anonymized photo with the one in the database
- If the photo is matched, the server returns the user ID.
- If the photo is not matched, the server returns an "401. Unauthorized" error.

<!-- Anonymization process:

- The photo is resized to 100x100 pixels.
- The photo is converted to grayscale.
- The photo is normalized to [0, 1].
- The photo is anonymized using the k-same pixel method on the client side. -->

### The flow of the face recognition model

The face recognition model is a simple CNN model:

```python
    model_input = layers.Input(shape=input_shape, name="input_image")

    x = layers.Conv2D(32, (3, 3), activation='relu', padding='same', name="conv1_1")(model_input)
    x = layers.BatchNormalization(name="bn1_1")(x)
    x = layers.Conv2D(32, (3, 3), activation='relu', padding='same', name="conv1_2")(x)
    x = layers.BatchNormalization(name="bn1_2")(x)
    x = layers.MaxPooling2D((2, 2), name="pool1")(x)
    x = layers.Dropout(0.25, name="drop1")(x)
```

- The photo is resized to 100x100 pixels.
- The photo is converted to grayscale.
- The photo is normalized to [0, 1].
- The photo is anonymized using the eigenface method, k-same pixel method and noise method.
- The photo is reconstructed to evaluate the quality of the anonymization.
- The photo is stored in the database.
