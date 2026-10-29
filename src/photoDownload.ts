import { NativeModules, Platform, Share } from 'react-native';
import { photoUrl } from './api';

type ReportPhotoDownloaderModule = {
  downloadReportPhoto(
    url: string,
    token: string,
    fileName: string,
  ): Promise<string>;
};

const downloader = NativeModules.ReportPhotoDownloader as
  | ReportPhotoDownloaderModule
  | undefined;

function safeFileName(value: string) {
  return (
    value
      .replace(/[\\/:*?"<>|\u0000-\u001F]/g, '_')
      .trim()
      .slice(0, 120) || `rssi-report-photo-${Date.now()}.jpg`
  );
}

export async function saveReportPhoto(
  path: string,
  token: string,
  fileName: string,
): Promise<'downloaded' | 'shared'> {
  const resolvedUrl = new URL(photoUrl(path));
  const apiOrigin = new URL(photoUrl('/')).origin;
  if (resolvedUrl.protocol !== 'https:' || resolvedUrl.origin !== apiOrigin) {
    throw new Error('This photo URL is not a trusted RSSI server address.');
  }
  if (!downloader) {
    throw new Error('Photo saving is not available in this app build.');
  }

  const savedUri = await downloader.downloadReportPhoto(
    resolvedUrl.toString(),
    token,
    safeFileName(fileName),
  );

  if (Platform.OS === 'android') return 'downloaded';
  if (Platform.OS === 'ios') {
    await Share.share({ url: savedUri, title: fileName });
    return 'shared';
  }

  throw new Error('Photo saving is supported on Android and iOS.');
}
