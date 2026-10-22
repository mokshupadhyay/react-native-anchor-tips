package com.anchortips;

import android.annotation.SuppressLint;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.view.MotionEvent;
import android.view.View;

/**
 * Full-screen dim layer with a rounded hole around the anchor. Android does
 * not pass touches between windows, so touches in the hole are swallowed
 * without dismissing the tip.
 */
@SuppressLint("ViewConstructor")
final class AnchorTipsBackdropView extends View {
  interface Listener {
    void onBackdropPress();
  }

  private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
  private final Path path = new Path();
  private final RectF hole = new RectF();
  private float radius;
  private final Listener listener;

  AnchorTipsBackdropView(Context context, Listener listener) {
    super(context);
    this.listener = listener;
  }

  void setHole(RectF next, float nextRadius, int color) {
    hole.set(next);
    radius = nextRadius;
    paint.setColor(color);
    invalidate();
  }

  @Override
  protected void onDraw(Canvas canvas) {
    super.onDraw(canvas);
    path.reset();
    path.setFillType(Path.FillType.EVEN_ODD);
    path.addRect(0, 0, getWidth(), getHeight(), Path.Direction.CW);
    if (!hole.isEmpty()) path.addRoundRect(hole, radius, radius, Path.Direction.CW);
    canvas.drawPath(path, paint);
  }

  @SuppressLint("ClickableViewAccessibility")
  @Override
  public boolean onTouchEvent(MotionEvent event) {
    if (event.getActionMasked() == MotionEvent.ACTION_UP && !hole.contains(event.getX(), event.getY())) {
      listener.onBackdropPress();
    }
    return true;
  }
}
