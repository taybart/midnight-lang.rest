# midnight checkout (sibling of this repo)
MIDNIGHT ?= ../midnight

.PHONY: playground

# builds the playground's midnight.wasm (and wasm_exec.js) into public/play,
# and compresses it ahead of time: rest sends midnight.wasm.br (or .gz) in
# place of midnight.wasm to browsers that accept it (see "Precompressed files"
# in rest's doc/SERVER.md). It's 6.4 MB, 1.25 MB as brotli, 1.7 MB as gzip.
playground:
	$(MAKE) -C $(MIDNIGHT) wasm WASM_OUT=$(CURDIR)/public/play
	brotli -q 11 -f -k public/play/midnight.wasm
	gzip -9 -f -k public/play/midnight.wasm
