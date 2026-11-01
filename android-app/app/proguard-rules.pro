# Keep the JNI bridge class + all its native methods so R8/ProGuard
# doesn't rename them (names must match Java_com_noveldl_Ndl_*).
-keep class com.noveldl.Ndl { *; }
-keepclassmembers class com.noveldl.Ndl { *; }
# Quiet the Rust jni crate's native bindings.
-dontwarn jni.**