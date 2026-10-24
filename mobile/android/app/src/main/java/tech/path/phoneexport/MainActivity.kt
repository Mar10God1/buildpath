package tech.path.phoneexport

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.provider.CallLog
import android.provider.Telephony
import android.widget.*
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant

/** Device-local pilot exporter, installed directly for testing, not a Play Store release. */
class MainActivity : Activity() {
    private lateinit var content: LinearLayout
    private lateinit var status: TextView
    private val records = mutableListOf<JSONObject>()
    private val selected = mutableSetOf<Int>()
    private var pendingPermission = ""
    private var pendingJson: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val layout = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(28,40,28,24) }
        setContentView(layout)
        layout.addView(TextView(this).apply { text = "Path · My phone"; textSize = 26f })
        layout.addView(TextView(this).apply { text = "Load up to 500 recent records. Select only work conversations. Export a JSON file, then import it under Calls & Texts → My phone in BuildPath or ConsultationPath. Nothing is uploaded by this app." })
        status = TextView(this); layout.addView(status)
        listOf("Choose texts" to Manifest.permission.READ_SMS, "Choose call records" to Manifest.permission.READ_CALL_LOG).forEach { (label, permission) ->
            layout.addView(Button(this).apply { text = label; setOnClickListener {
                pendingPermission = permission
                if (checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED) load(permission)
                else requestPermissions(arrayOf(permission), 10)
            } })
        }
        layout.addView(Button(this).apply { text = "Export selected records"; setOnClickListener {
            if (selected.isEmpty()) { status.text = "Select at least one record first."; return@setOnClickListener }
            pendingJson = JSONObject().put("records", JSONArray(selected.sorted().map { records[it] })).toString(2)
            startActivityForResult(Intent(Intent.ACTION_CREATE_DOCUMENT).apply { addCategory(Intent.CATEGORY_OPENABLE); type = "application/json"; putExtra(Intent.EXTRA_TITLE,"path-phone-export.json") }, 20)
        } })
        val scroll = ScrollView(this); content = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        scroll.addView(content); layout.addView(scroll, LinearLayout.LayoutParams(-1,0,1f))
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == 10 && grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) load(pendingPermission)
        else status.text = "Permission declined or unavailable. You can still paste selected messages or import an existing export on the website."
    }

    private fun load(permission: String) {
        status.text = "Reading on this device…"
        records.clear(); selected.clear(); content.removeAllViews()
        Thread {
            try {
                val found = mutableListOf<JSONObject>()
                val sms = permission == Manifest.permission.READ_SMS
                val uri = if (sms) Telephony.Sms.CONTENT_URI else CallLog.Calls.CONTENT_URI
                val projection = if (sms) arrayOf("address","body","date","type") else arrayOf("number","date","type","duration","name")
                contentResolver.query(uri,projection,null,null,"date DESC")?.use { cursor ->
                    while (cursor.moveToNext() && found.size < 500) {
                        fun field(name: String) = cursor.getString(cursor.getColumnIndexOrThrow(name)) ?: ""
                        val phone = field(if (sms) "address" else "number")
                        val type = field("type").toIntOrNull() ?: 0
                        // Exclude drafts and queued / failed outgoing SMS.
                        if (sms && type !in listOf(1,2)) continue
                        val normalized = phone.replace(Regex("[\\s()\\-.]"),"")
                        val e164 = if (Regex("^\\+[1-9]\\d{7,14}$").matches(normalized)) normalized else ""
                        val name = if (sms) phone else field("name").ifEmpty { phone }
                        val body = if (sms) field("body") else "Call record · ${field("duration")} seconds · ${if(type == 3) "missed" else if(type == 2) "outgoing" else "incoming"}. No audio or transcript included."
                        if (body.isBlank() || name.isBlank()) continue
                        found.add(JSONObject().put("kind",if(sms) "sms" else "call").put("contact",name).put("phone",e164).put("direction",if(type == 2) "outbound" else "inbound").put("occurredAt",Instant.ofEpochMilli(field("date").toLong()).toString()).put("text",body))
                    }
                }
                runOnUiThread {
                    records.addAll(found)
                    status.text = "${records.size} records loaded. Nothing selected. Numbers without an international prefix are kept as contact names."
                    records.forEachIndexed { i, record -> content.addView(CheckBox(this).apply {
                        text = "${record.getString("contact")} · ${record.getString("occurredAt")}\n${record.getString("text").take(160)}"
                        setOnCheckedChangeListener { _, checked -> if(checked) selected.add(i) else selected.remove(i); status.text = "${selected.size} selected of ${records.size}" }
                    }) }
                }
            } catch (_: Exception) { runOnUiThread { status.text = "Device access is unavailable. Use a file export or paste selected conversations on the website." } }
        }.start()
    }

    @Deprecated("Uses platform activity result for dependency-free pilot")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode,resultCode,data)
        if (requestCode != 20) return
        if (resultCode != RESULT_OK) { pendingJson = null; return }
        try {
            val uri = data?.data ?: error("No destination")
            val stream = contentResolver.openOutputStream(uri) ?: error("Cannot write destination")
            stream.bufferedWriter().use { it.write(pendingJson ?: error("Nothing selected")) }
            status.text = "Export saved. Import the file in your project's Calls & Texts → My phone."
        } catch (_: Exception) { status.text = "Export could not be saved. Please try another destination." }
        finally { pendingJson = null }
    }
}
