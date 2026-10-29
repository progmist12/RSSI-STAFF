import Foundation
import React

@objc(ReportPhotoDownloader)
class ReportPhotoDownloader: NSObject {
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }

  @objc
  func downloadReportPhoto(
    _ urlString: String,
    token: String,
    fileName: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let url = URL(string: urlString), url.scheme == "https", !token.isEmpty else {
      reject("invalid_photo_download", "A secure photo URL and staff session are required.", nil)
      return
    }

    var request = URLRequest(url: url)
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    request.setValue("true", forHTTPHeaderField: "ngrok-skip-browser-warning")

    URLSession.shared.dataTask(with: request) { data, response, error in
      if let error = error {
        reject("photo_download_failed", "Could not download this photo. Check the connection and try again.", error)
        return
      }
      guard let httpResponse = response as? HTTPURLResponse,
            (200..<300).contains(httpResponse.statusCode),
            let data = data else {
        reject("photo_download_failed", "The server could not provide this photo.", nil)
        return
      }

      let safeName = fileName
        .replacingOccurrences(of: "[^A-Za-z0-9._-]", with: "_", options: .regularExpression)
        .prefix(120)
      let name = safeName.isEmpty ? "rssi-report-photo.jpg" : String(safeName)
      let directory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        .appendingPathComponent("RSSI Downloads", isDirectory: true)
      let fileURL = directory.appendingPathComponent(name)

      do {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try data.write(to: fileURL, options: .atomic)
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        var excludedURL = fileURL
        try? excludedURL.setResourceValues(values)
        resolve(fileURL.absoluteString)
      } catch {
        reject("photo_save_failed", "The photo downloaded but could not be saved on this device.", error)
      }
    }.resume()
  }
}
