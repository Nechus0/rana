use crate::error::Result;
pub fn ensure_db_key() -> Result<[u8; 32]> { Ok([7u8; 32]) }
pub fn export_db_key_b64() -> Result<String> {
    use base64::{engine::general_purpose::STANDARD as B64, Engine};
    Ok(B64.encode([7u8; 32]))
}
pub fn set_db_key(_k: &[u8; 32]) -> Result<()> { Ok(()) }
