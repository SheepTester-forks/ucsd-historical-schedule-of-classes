use std::{collections::HashMap, fs};

use serde::Deserialize;

#[derive(Deserialize, Debug)]
struct Course {
    title: String,
    catalog: Option<String>,
    note: Option<String>,
}

#[derive(Deserialize, Debug)]
struct Subject {
    name: String,
    courses: HashMap<String, Course>,
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    for entry in fs::read_dir("..")? {
        let entry = entry?;
        if entry.path().extension().and_then(|s| s.to_str()) == Some("toml") {
            match toml::from_str::<HashMap<String, Subject>>(&fs::read_to_string(entry.path())?) {
                Ok(_) => {}
                Err(err) => {
                    eprintln!(
                        "Failed to parse {:?} {:?}: {}",
                        entry.file_name(),
                        err.span(),
                        err.message()
                    );
                }
            }
        }
    }
    Ok(())
}
