import subprocess
import sys
import os

print("Installing tensorflowjs and tensorflow_hub...")
try:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "tensorflowjs==3.18.0", "tensorflow_hub", "--no-deps"])
except Exception as e:
    print(f"Error installing dependencies: {e}")
    sys.exit(1)

# Apply monkeypatch to fix "Duplicate registrations for type trackable_dict_wrapper"
print("Applying TensorFlow Hub registration monkeypatch...")
try:
    import tensorflow as tf
    from tensorflow.python.saved_model import revived_types
    orig_register = revived_types.register_revived_type
    
    def custom_register(identifier, *args, **kwargs):
        if identifier in revived_types._REVIVED_TYPE_REGISTRY:
            # Silence duplicate registration errors
            return
        return orig_register(identifier, *args, **kwargs)
        
    revived_types.register_revived_type = custom_register
    print("Monkeypatch applied successfully.")
except Exception as patch_err:
    print(f"Warning: could not apply monkeypatch: {patch_err}")

print("Converting Keras model to TensorFlow.js...")
model_path = os.path.join("model", "model.h5")
output_path = os.path.join("docs", "model_tfjs")

if not os.path.exists(model_path):
    print(f"Model file not found at {model_path}!")
    sys.exit(1)

os.makedirs(output_path, exist_ok=True)

try:
    import tensorflowjs as tfjs
    import tensorflow as tf
    
    print("Loading model...")
    model = tf.keras.models.load_model(model_path)
    print("Saving model to TensorFlow.js format...")
    tfjs.converters.save_keras_model(model, output_path)
    print(f"Successfully converted model. Files saved in: {output_path}")
except Exception as e:
    print(f"Failed to convert model: {e}")
    sys.exit(1)
