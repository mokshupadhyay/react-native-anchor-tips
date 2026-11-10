#import <UIKit/UIKit.h>

#import "AnchorTipGeometry.h"

NS_ASSUME_NONNULL_BEGIN

/**
 * Events reported by a tip view:
 * `press`, `action` (payload: id, dismissOnPress), `close`.
 */
typedef void (^AnchorTipViewEventHandler)(NSString *kind, NSDictionary *payload);

/** One tip bubble, with its arrow, drawn from a fully resolved config produced in JavaScript. */
@interface AnchorTipView : UIView

@property (nonatomic, copy, readonly) NSString *tipId;
@property (nonatomic, copy, readonly) NSDictionary *config;
@property (nonatomic, assign) BOOL dismissing;
@property (nonatomic, copy, nullable) AnchorTipViewEventHandler onEvent;

- (instancetype)initWithTipId:(NSString *)tipId config:(NSDictionary *)config;
- (void)applyConfig:(NSDictionary *)config;

/** Bubble size for the given maximum width, without the arrow. */
- (CGSize)fittingSizeForMaxWidth:(CGFloat)maxWidth;

/** Position the bubble and draw the arrow on the edge that faces the anchor. */
- (void)applyPlacement:(AnchorTipPlacement)placement size:(CGSize)size;

- (void)animateIn;
- (void)animateOutWithCompletion:(void (^)(void))completion;

@end

/** Dims the screen around a rounded cutout. Touches inside the cutout pass through. */
@interface AnchorTipBackdropView : UIView

@property (nonatomic, copy, nullable) void (^onTap)(void);

- (void)setHole:(CGRect)hole radius:(CGFloat)radius color:(UIColor *)color;
- (BOOL)holeContainsPoint:(CGPoint)point;

@end

NS_ASSUME_NONNULL_END
