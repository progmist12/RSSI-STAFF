package com.rssi_staff

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.Environment
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class ReportPhotoDownloaderModule(
  reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "ReportPhotoDownloader"

  @ReactMethod
  fun downloadReportPhoto(
    url: String,
    token: String,
    fileName: String,
    promise: Promise,
  ) {
    val photoUri = Uri.parse(url)
    if (photoUri.scheme != "https" || token.isBlank()) {
      promise.reject("invalid_photo_download", "A secure photo URL and staff session are required.")
      return
    }

    try {
      val safeName = fileName
        .replace(Regex("[^A-Za-z0-9._-]"), "_")
        .take(120)
        .ifBlank { "rssi-report-photo.jpg" }
      val request = DownloadManager.Request(photoUri)
        .setTitle(safeName)
        .setDescription("Saving farmer-submitted report photo")
        .setMimeType("image/*")
        .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
        .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, safeName)
        .addRequestHeader("Authorization", "Bearer $token")
        .addRequestHeader("ngrok-skip-browser-warning", "true")

      val manager =
        reactApplicationContext.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
      val downloadId = manager.enqueue(request)
      promise.resolve(downloadId.toString())
    } catch (error: Exception) {
      promise.reject(
        "photo_download_failed",
        "Could not start saving this photo. Check the connection and try again.",
        error,
      )
    }
  }
}
