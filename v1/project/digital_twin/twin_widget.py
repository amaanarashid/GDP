"""
digital_twin/twin_widget.py
=============================
A QWidget that draws a simple 2D schematic of the machine (conveyor by
default, but layout is keyed off component name so it degrades gracefully
for other machine types) and colors each component according to its
current health score using the shared status_for_score() rules.
"""

from __future__ import annotations
from PyQt6.QtWidgets import QWidget
from PyQt6.QtGui import QPainter, QColor, QFont, QPen, QBrush
from PyQt6.QtCore import Qt, QRectF
from config import status_for_score

# Fixed layout positions for the known conveyor components. Components not
# listed here are drawn in an overflow row at the bottom, so unknown /
# future machine types still render without crashing.
LAYOUT = {
    "Motor":          (40, 90, 110, 70),
    "Gearbox":        (180, 90, 110, 70),
    "Bearing":        (320, 90, 110, 70),
    "Conveyor Belt":  (40, 190, 390, 40),
    "Cooling Fan":    (320, 20, 110, 60),
}


class TwinWidget(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.component_health: dict[str, float] = {}
        self.setMinimumSize(480, 280)

    def update_health(self, component_health: dict[str, float]) -> None:
        self.component_health = component_health
        self.update()  # triggers paintEvent

    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        painter.fillRect(self.rect(), QColor("#1e1e2e"))

        font = QFont("Segoe UI", 9)
        painter.setFont(font)

        extra_y = 250
        for name, health in self.component_health.items():
            _, color_hex = status_for_score(health)
            color = QColor(color_hex)

            if name in LAYOUT:
                x, y, w, h = LAYOUT[name]
            else:
                x, y, w, h = 40, extra_y, 150, 40
                extra_y += 50

            rect = QRectF(x, y, w, h)
            painter.setPen(QPen(QColor("#333344"), 2))
            painter.setBrush(QBrush(color))
            painter.drawRoundedRect(rect, 8, 8)

            painter.setPen(QPen(QColor("#0d0d14")))
            label = f"{name}\n{health:.0f}%"
            painter.drawText(rect, Qt.AlignmentFlag.AlignCenter, label)

        if not self.component_health:
            painter.setPen(QPen(QColor("#888")))
            painter.drawText(self.rect(), Qt.AlignmentFlag.AlignCenter,
                              "No component data yet")

        painter.end()
