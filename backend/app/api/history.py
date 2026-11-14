from fastapi import APIRouter, HTTPException
from typing import List
from app.models.schemas import HistoryItem
from app.services.history import history_manager

router = APIRouter(prefix="/history", tags=["History"])

@router.get("", response_model=List[HistoryItem])
async def get_history():
    return history_manager.get_all()

@router.delete("/{item_id}")
async def delete_history_item(item_id: str):
    success = history_manager.delete(item_id)
    if not success:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Deleted successfully"}

@router.delete("")
async def clear_all_history():
    history_manager.clear()
    return {"message": "History cleared"}
