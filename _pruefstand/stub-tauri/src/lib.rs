use std::path::PathBuf;
pub struct PathResolver;
impl PathResolver { pub fn app_data_dir(&self) -> Result<PathBuf, ()> { Ok(PathBuf::from("/tmp/x")) } }
pub struct AppHandle;
pub trait Manager { fn path(&self) -> PathResolver { PathResolver } }
impl Manager for AppHandle {}
