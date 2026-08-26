#[derive(Debug)]
pub enum Error { NoEntry, Other }
impl std::fmt::Display for Error { fn fmt(&self, f:&mut std::fmt::Formatter)->std::fmt::Result{ write!(f,"keyring") } }
impl std::error::Error for Error {}
