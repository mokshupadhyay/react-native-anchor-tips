package com.anchortips;

import android.annotation.SuppressLint;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.view.MotionEvent;
import android.view.View;

/** Dims the screen around a rounded cutout. Hosted in its own full-screen window. */
@SuppressLint("ViewConstructor")
final class AnchorTipBackdropView extends View {
  interface Listener {
    void onBackdropTap(AnchorTipBackdropView view);
  }

  final String tipId;
  private final Listener listener;
  private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
  private final Path path = new Path();
  /** Cutout in screen pixels. */
  private final RectF hole = new RectF();
  private float radius;
  private final int[] location = new int[2];

  AnchorTipBackdropView(Context context, String tipId, Listener listener) {
    super(context);
    this.tipId = tipId;
    this.listener = listener;
    paint.setStyle(Paint.Style.FILL);
  }

  void setHole(RectF screenHole, float radiusPx, int color) {
    hole.set(screenHole);
    radius = radiusPx;
    paint.setColor(color);
    invalidate();
  }

  @Override
  protected void onDraw(Canvas canvas) {
    super.onDraw(canvas);
    getLocationOnScreen(location);
    RectF local = new RectF(hole);
    local.offset(-location[0], -location[1]);
    path.reset();
    path.setFillType(Path.FillType.EVEN_ODD);
    path.addRect(0, 0, getWidth(), getHeight(), Path.Direction.CW);
    path.addRoundRect(local, radius, radius, Path.Direction.CW);
    canvas.drawPath(path, paint);
  }

  @SuppressLint("ClickableViewAccessibility")
  @Override
  public boolean onTouchEvent(MotionEvent event) {
    if (event.getActionMasked() == MotionEvent.ACTION_UP) {
      getLocationOnScreen(location);
      boolean inHole = hole.contains(event.getX() + location[0], event.getY() + location[1]);
      if (!inHole) listener.onBackdropTap(this);
    }
    return true;
  }
}
