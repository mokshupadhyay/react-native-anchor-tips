#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * Hosts native tips in a dedicated pass-through window above the app,
 * including React Native modals. The window never becomes key, so focus and
 * the keyboard stay with the app. Touches outside tips reach the app.
 */
@interface AnchorTipsOverlay : NSObject

/** Receives `{ id, kind, actionId?, reason? }` dictionaries for JavaScript. */
@property (nonatomic, copy, nullable) void (^eventSink)(NSDictionary *event);

- (void)show:(NSString *)tipId config:(NSDictionary *)config;
- (void)update:(NSString *)tipId config:(NSDictionary *)config;
- (void)dismiss:(NSString *)tipId reason:(NSString *)reason;
- (void)dismissAll;

@end

NS_ASSUME_NONNULL_END
