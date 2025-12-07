#[ic_cdk::query]
fn greet(name: String) -> String {
    format!("Volumetric, {}!", name)
}

ic_cdk::export_candid!();
