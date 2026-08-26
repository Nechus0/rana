#[derive(Debug)]
pub struct Error;
impl Error { pub fn is_timeout(&self)->bool{false} pub fn is_connect(&self)->bool{false} }
impl std::fmt::Display for Error { fn fmt(&self, f:&mut std::fmt::Formatter)->std::fmt::Result{ write!(f,"reqwest") } }
impl std::error::Error for Error {}
