package com.noveldl

import android.Manifest
import android.content.ContentValues
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.Bundle
import android.provider.MediaStore
import android.text.TextUtils
import android.view.View
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.net.toUri
import com.google.android.material.button.MaterialButton
import com.google.android.material.card.MaterialCardView
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    private val scope = CoroutineScope(Dispatchers.Main)

    private lateinit var inputLayout: TextInputLayout
    private lateinit var linkInput: TextInputEditText
    private lateinit var proxyLayout: TextInputLayout
    private lateinit var proxyInput: TextInputEditText
    private lateinit var cookieLayout: TextInputLayout
    private lateinit var cookieInput: TextInputEditText
    private lateinit var downloadBtn: MaterialButton
    private lateinit var progress: com.google.android.material.progressindicator.LinearProgressIndicator
    private lateinit var statusText: android.widget.TextView
    private lateinit var resultCard: MaterialCardView
    private lateinit var resultText: android.widget.TextView
    private lateinit var openBtn: MaterialButton
    private lateinit var versionText: android.widget.TextView

    private val bridge = Ndl()

    private val requestPermissionsLauncher: ActivityResultLauncher<Array<String>> =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { results ->
            results.forEach { (name, ok) ->
                if (!ok) {
                    Toast.makeText(this, "Permission $name denied", Toast.LENGTH_SHORT).show()
                }
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        inputLayout = findViewById(R.id.inputLayout)
        linkInput = findViewById(R.id.linkInput)
        proxyLayout = findViewById(R.id.proxyLayout)
        proxyInput = findViewById(R.id.proxyInput)
        cookieLayout = findViewById(R.id.cookieLayout)
        cookieInput = findViewById(R.id.cookieInput)
        downloadBtn = findViewById(R.id.downloadBtn)
        progress = findViewById(R.id.progress)
        statusText = findViewById(R.id.statusText)
        resultCard = findViewById(R.id.resultCard)
        resultText = findViewById(R.id.resultText)
        openBtn = findViewById(R.id.openBtn)
        versionText = findViewById(R.id.versionText)

        versionText.text = "engine v${bridge.nativeVersion()}"

        downloadBtn.setOnClickListener { startDownload() }
        openBtn.setOnClickListener { openResult() }
    }

    private fun startDownload() {
        val raw = linkInput.text?.toString()?.trim().orEmpty()
        if (raw.isEmpty()) {
            inputLayout.error = getString(R.string.err_link_empty)
            return
        }
        inputLayout.error = null

        val bookId = bridge.nativeExtractBookId(raw)
        if (bookId.isEmpty()) {
            inputLayout.error = getString(R.string.err_no_book_id)
            return
        }

        val proxy = proxyInput.text?.toString()?.trim().takeIf { !it.isNullOrEmpty() }
        val cookie = cookieInput.text?.toString()?.trim().takeIf { !it.isNullOrEmpty() }

        ensurePermissions { onPermissionsGranted() }
    }

    private fun ensurePermissions(block: () -> Unit) {
        val needed = mutableListOf<String>()
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) !=
                PackageManager.PERMISSION_GRANTED
            ) {
                needed += Manifest.permission.WRITE_EXTERNAL_STORAGE
            }
        }
        if (needed.isEmpty()) {
            block()
        } else {
            requestPermissionsLauncher.launch(needed.toTypedArray()) {
                // re-run after result is handled by the launcher
            }
            // The launcher callback already fires onPermissionsGranted in the result map.
        }
    }

    private fun onPermissionsGranted() {
        // Called from the permissions result path; trigger the download.
        val raw = linkInput.text?.toString()?.trim().orEmpty()
        val bookId = bridge.nativeExtractBookId(raw)
        if (bookId.isEmpty()) {
            Toast.makeText(this, getString(R.string.err_no_book_id), Toast.LENGTH_SHORT).show()
            return
        }
        runDownload(bookId)
    }

    private fun runDownload(bookId: String) {
        setBusy(true, getString(R.string.status_downloading))

        val outDir = getExternalFilesDir(null)?.absolutePath ?: filesDir.absolutePath
        val proxy = proxyInput.text?.toString()?.trim()
        val cookie = cookieInput.text?.toString()?.trim()

        scope.launch(Dispatchers.IO) {
            val json = bridge.nativeDownload(bookId, outDir)
            runCatching {
                val obj = org.json.JSONObject(json)
                val ok = obj.optBoolean("ok", false)
                val path = obj.optString("output_path", "")
                val bookName = obj.optString("book_name", "")
                val chapters = obj.optInt("chapter_count", 0)
                val error = obj.optString("error", "")

                if (ok && path.isNotEmpty()) {
                    val src = java.io.File(path)
                    if (src.exists()) {
                        val publicUri = publishToDownloads(src, bookName, chapters)
                        withMain {
                            showResult(bookName, chapters, publicUri, src)
                        }
                    } else {
                        withMain { setBusy(false, "saved at $path") }
                    }
                } else {
                    withMain { setBusy(false, "error: $error") }
                }
            }.onFailure {
                withMain { setBusy(false, "error: ${it.message}") }
            }
        }
    }

    private fun withMain(block: () -> Unit) {
        scope.launch(Dispatchers.Main) { block() }
    }

    /** Copy the app-private file into the public Downloads folder. */
    private fun publishToDownloads(src: java.io.File, bookName: String, chapters: Int): Uri {
        val safeName = bookName.replace(Regex("[^\\w\\u4e00-\\u9fa5()\\- ]"), "_").trim()
        val displayName = "${if (safeName.isEmpty()) "novel" else safeName}_c$chapters.txt"

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val values = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, displayName)
                put(MediaStore.Downloads.MIME_TYPE, "text/plain")
                put(MediaStore.Downloads.RELATIVE_PATH, "Download")
            }
            val uri = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                ?: return src.toUri()
            contentResolver.openOutputStream(uri)?.use { out ->
                src.inputStream().use { it.copyTo(out) }
            }
            return uri
        } else {
            @Suppress("DEPRECATION")
            val dest = File(Environment.getExternalStorageDirectory(), "Download/$displayName")
            src.copyTo(dest, overwrite = true)
            return Uri.fromFile(dest)
        }
    }

    private fun showResult(bookName: String, chapters: Int, publicUri: Uri, local: java.io.File) {
        setBusy(false, getString(R.string.status_done, bookName, chapters))
        resultCard.visibility = View.VISIBLE
        resultText.text = getString(R.string.result_template, bookName, chapters)
        downloadBtn.isEnabled = true
        openBtn.visibility = View.VISIBLE
        openBtn.text = getString(R.string.btn_open)
        openBtn.tag = publicUri.toString()
    }

    private fun openResult() {
        val uriStr = openBtn.tag as? String ?: return
        runCatching {
            val intent = Intent(Intent.ACTION_VIEW).apply {
                dataAndType = Uri.parse(uriStr) to "text/plain"
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            startActivity(Intent.createChooser(intent, getString(R.string.open_with)))
        }.onFailure {
            Toast.makeText(this, "no app to open: ${it.message}", Toast.LENGTH_LONG).show()
        }
    }

    private fun setBusy(busy: Boolean, status: String) {
        progress.visibility = if (busy) View.VISIBLE else View.INVISIBLE
        downloadBtn.isEnabled = !busy
        statusText.text = status
        if (busy) openBtn.visibility = View.GONE
    }

    private fun openWith() = {}
}

// helper
private fun MainActivity.filesDirSafe(): java.io.File = this.filesDir