#import <UIKit/UIKit.h>

#import "AnchorTipGeometry.h"

NS_ASSUME_NONNULL_BEGIN

/**
 * Events reported by a tip view: `press`, `action` (payload: id, dismissOnPress), `close`.
 */
typedef void (^AnchorTipViewEventHandler)(NSString *kind, NSDictionary *payload);

/** One tip bubble drawn from a fully resolved config produced in JavaScript. */
@interface AnchorTipView : UIView

@property (nonatomic, copy, readonly) NSString *tipId;
@property (nonatomic, copy, readonly) NSDictionary *config;
@property (nonatomic, assign, readonly) AnchorTipPlacement placement;
@property (nonatomic, assign) BOOL dismissing;
@property (nonatomic, copy, nullable) AnchorTipViewEventHandler onEvent;

- (instancetype)initWithTipId:(NSString *)tipId config:(NSDictionary *)config;
- (void)applyConfig:(NSDictionary *)config;

/** Size of the bubble body, without the arrow, when it may be at most `maxWidth` wide. */
- (CGSize)fittingSizeForMaxWidth:(CGFloat)maxWidth;

/** Where the arrow points. `arrowSize` 0 hides it. */
- (void)setPlacement:(AnchorTipPlacement)placement arrowOffset:(CGFloat)arrowOffset arrowSize:(CGFloat)arrowSize;

@end

FOUNDATION_EXPORT CGFloat AnchorTipNumber(NSDictionary *_Nullable dict, NSString *key, CGFloat fallback);
FOUNDATION_EXPORT BOOL AnchorTipBool(NSDictionary *_Nullable dict, NSString *key, BOOL fallback);
FOUNDATION_EXPORT NSString *_Nullable AnchorTipString(NSDictionary *_Nullable dict, NSString *key);
FOUNDATION_EXPORT UIColor *AnchorTipColor(NSDictionary *_Nullable dict, NSString *key, UIColor *fallback);
FOUNDATION_EXPORT NSDictionary *AnchorTipStyle(NSDictionary *config);

NS_ASSUME_NONNULL_END
