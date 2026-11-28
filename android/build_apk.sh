#!/bin/bash
# Build the offline reader APK from the shared reader/worker source.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
BUILD="$HERE/build"
SDK_JAR="${SDK_JAR:-/usr/lib/android-sdk/platforms/android-23/android.jar}"
BT="${BT:-/usr/lib/android-sdk/build-tools/29.0.3}"
AAPT2="${AAPT2:-$(command -v aapt2 || echo /usr/bin/aapt2)}"
D8="${D8:-/root/tools/r8.jar}"
KEYSTORE="${KEYSTORE:-${HOME}/novelreader.keystore}"
KS_PASS="${KS_PASS:-novelreader}"
PKG=com.a8219.novelreader
APK_NAME="本地小说阅读-离线版-1.0.apk"

rm -rf "$BUILD"
mkdir -p "$BUILD/classes" "$BUILD/res/mipmap-xxhdpi" "$BUILD/res/values"

python3 "$HERE/build_assets.py"

python3 "$HERE/make_icon.py" "$BUILD/res/mipmap-xxhdpi/ic_launcher.png"
cp "$HERE/res/values/strings.xml" "$BUILD/res/values/strings.xml"
sed 's#android:label="本地小说阅读"#android:label="@string/app_name"#g' "$HERE/AndroidManifest.xml" > "$BUILD/AndroidManifest.xml"

javac -source 8 -target 8 -encoding UTF-8 -bootclasspath "$SDK_JAR" \
  -d "$BUILD/classes" $(find "$HERE/java" -name '*.java')

java -cp "$D8" com.android.tools.r8.D8 --release --min-api 23 --lib "$SDK_JAR" \
  --output "$BUILD" $(find "$BUILD/classes" -name '*.class')

"$AAPT2" compile --dir "$BUILD/res" -o "$BUILD/res.zip"
"$AAPT2" link -o "$BUILD/base.apk" \
  --manifest "$BUILD/AndroidManifest.xml" \
  -I "$SDK_JAR" \
  -A "$BUILD/assets" \
  --min-sdk-version 23 --target-sdk-version 29 \
  "$BUILD/res.zip"

cd "$BUILD"
cp base.apk unsigned.apk
zip -q -j unsigned.apk classes.dex
"$BT/zipalign" -f 4 unsigned.apk aligned.apk

if [ ! -f "$KEYSTORE" ]; then
  keytool -genkeypair -keystore "$KEYSTORE" -alias novelreader -keyalg RSA -keysize 2048 \
    -validity 10000 -storepass "$KS_PASS" -keypass "$KS_PASS" \
    -dname "CN=NovelReader Local,OU=Local,O=Local,C=CN" >/dev/null 2>&1
fi
chmod 600 "$KEYSTORE"

"$BT/apksigner" sign --ks "$KEYSTORE" --ks-pass "pass:$KS_PASS" --key-pass "pass:$KS_PASS" \
  --out "$BUILD/$APK_NAME" aligned.apk

rm -f unsigned.apk aligned.apk base.apk res.zip
ls -lh "$BUILD/$APK_NAME"
"$BT/aapt" dump badging "$BUILD/$APK_NAME" | head -8
