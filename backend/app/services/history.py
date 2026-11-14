import json
from pathlib import Path
from typing import List, Optional
from datetime import datetime
from app.config import DATA_DIR
from app.models.schemas import HistoryItem

HISTORY_FILE = DATA_DIR / "history.json"

class HistoryManager:
    def __init__(self):
        self._ensure_file()

    def _ensure_file(self):
        if not HISTORY_FILE.exists():
            with open(HISTORY_FILE, "w", encoding="utf-8") as f:
                json.dump([], f)

    def get_all(self) -> List[HistoryItem]:
        self._ensure_file()
        try:
            with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return [HistoryItem(**item) for item in data]
        except Exception:
            return []

    def add(self, item: HistoryItem) -> HistoryItem:
        items = self.get_all()
        # Insert at front
        items.insert(0, item)
        # Limit to 50 items
        items = items[:50]
        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump([i.dict() for i in items], f, indent=2)
        return item

    def delete(self, item_id: str) -> bool:
        items = self.get_all()
        new_items = [i for i in items if i.id != item_id]
        if len(new_items) != len(items):
            with open(HISTORY_FILE, "w", encoding="utf-8") as f:
                json.dump([i.dict() for i in new_items], f, indent=2)
            return True
        return False

    def clear(self):
        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump([], f)

history_manager = HistoryManager()
