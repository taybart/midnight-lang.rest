# midnight checkout (sibling of this repo)
MIDNIGHT ?= ../midnight

.PHONY: playground

# builds the playground's midnight.wasm (and wasm_exec.js) into public/play,
# gzipped: the page fetches midnight.wasm.gz and decompresses it itself, so
# it's 1.6 MB over the wire w/o the server compressing it on every request
playground:
	$(MAKE) -C $(MIDNIGHT) wasm WASM_OUT=$(CURDIR)/public/play
	gzip -9 -f public/play/midnight.wasm
