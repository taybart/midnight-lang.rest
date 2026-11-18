# midnight checkout (sibling of this repo)
MIDNIGHT ?= ../midnight
# corvid checkout
CORVID ?= ../../corvid

.PHONY: playground corvid

# builds the playground's midnight.wasm (and wasm_exec.js) into public/js/vendor,
# and compresses it ahead of time: rest sends midnight.wasm.br (or .gz) in
# place of midnight.wasm to browsers that accept it (see "Precompressed files"
# in rest's doc/SERVER.md). It's 6.4 MB, 1.25 MB as brotli, 1.7 MB as gzip.
#
# It also writes a hash of the build into src/assets.mn (midnight_wasm's ?v=),
# so browsers w/ an old build cached fetch the new one.
playground:
	$(MAKE) -C $(MIDNIGHT) wasm WASM_OUT=$(CURDIR)/public/js/vendor
	brotli -q 11 -f -k public/js/vendor/midnight.wasm
	gzip -9 -f -k public/js/vendor/midnight.wasm
	@$(call version,midnight.wasm)

# copies corvid's bundle (build it first: `pnpm build` in corvid) into
# public/js/vendor, and writes a hash of it into src/assets.mn (corvid's ?v=)
corvid:
	cp $(CORVID)/dist/bundle/corvid.bundle.js public/js/vendor/corvid.bundle.js
	@$(call version,corvid.bundle.js)

# version(file): writes a hash of public/js/vendor/<file> into its url's ?v=
# in src/assets.mn
define version
	v=$$(shasum -a 256 public/js/vendor/$(1) | cut -c1-10); \
		sed -i.bak "s#$(subst .,\\.,$(1))?v=[^']*'#$(1)?v=$$v'#" src/assets.mn && rm src/assets.mn.bak; \
		echo "$(1)?v=$$v (src/assets.mn)"
endef
