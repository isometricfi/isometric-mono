FROM --platform=linux/amd64 ubuntu:22.04

ENV RUSTUP_HOME=/opt/rustup
ENV CARGO_HOME=/opt/cargo
ENV PATH=/opt/cargo/bin:${PATH}
ENV RUST_VERSION=1.85.0
ENV DFX_VERSION=0.29.2
ENV DFXVM_INIT_YES=true

RUN apt -yq update && \
    apt -yqq install --no-install-recommends \
    curl \
    ca-certificates \
    build-essential \
    pkg-config \
    libssl-dev \
    llvm-dev \
    liblmdb-dev \
    clang \
    cmake \
    rsync

RUN curl --fail https://sh.rustup.rs -sSf \
    | sh -s -- -y --default-toolchain ${RUST_VERSION}-x86_64-unknown-linux-gnu --no-modify-path && \
    rustup default ${RUST_VERSION}-x86_64-unknown-linux-gnu && \
    rustup target add wasm32-unknown-unknown && \
    cargo install ic-wasm

RUN DFX_VERSION=${DFX_VERSION} sh -ci "$(curl -fsSL https://internetcomputer.org/install.sh)"
ENV PATH=/root/.local/share/dfx/bin:${PATH}

COPY . /canister
WORKDIR /canister

RUN chmod +x ./docker/entrypoint.sh
ENTRYPOINT ["./docker/entrypoint.sh"]

