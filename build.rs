fn main() {
    println!("cargo:rerun-if-env-changed=BUILD_SHA");
    let build_sha = std::env::var("BUILD_SHA")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "dev".into());
    println!("cargo:rustc-env=BUILD_SHA={build_sha}");
}
