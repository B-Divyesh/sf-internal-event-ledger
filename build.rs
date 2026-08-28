fn main() {
    println!("cargo:rerun-if-env-changed=BUILD_SHA");
    let build_sha = std::env::var("BUILD_SHA").unwrap_or_else(|_| "dev".into());
    println!("cargo:rustc-env=BUILD_SHA={build_sha}");
}
