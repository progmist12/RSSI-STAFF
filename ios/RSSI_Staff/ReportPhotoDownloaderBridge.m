#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(ReportPhotoDownloader, NSObject)
RCT_EXTERN_METHOD(downloadReportPhoto:(NSString *)url
                  token:(NSString *)token
                  fileName:(NSString *)fileName
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
@end
