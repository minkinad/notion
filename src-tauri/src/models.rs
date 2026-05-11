use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PageRecord {
    pub id: String,
    pub parent_id: Option<String>,
    pub title: String,
    pub position: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BlockRecord {
    pub id: String,
    pub page_id: String,
    #[serde(rename = "type")]
    pub block_type: String,
    pub content: String,
    pub checked: bool,
    pub position: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BlockInput {
    pub id: String,
    #[serde(rename = "type")]
    pub block_type: String,
    pub content: String,
    pub checked: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSnapshot {
    pub pages: Vec<PageRecord>,
    pub blocks: Vec<BlockRecord>,
    pub active_page_id: Option<String>,
    pub recent_page_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePageResponse {
    pub page: PageRecord,
    pub initial_block: BlockRecord,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceContextInput {
    pub active_page_id: Option<String>,
    pub recent_page_ids: Vec<String>,
}
