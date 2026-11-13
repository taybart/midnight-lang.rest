# Getting Started

## Install

Midnight ships as a Go library and a `midnight` CLI:

```sh copy
go get github.com/taybart/midnight
go install github.com/taybart/midnight/cmd/midnight@latest
```

Check that it works:

```sh
midnight -e 'print("hello {_VERSION}")'
```

## Run a script

Scripts that don't end in `.lua` run as Midnight (use `-lang lua` or
`-lang midnight` to override).

```sh
midnight hello.mn            # run a file
cat hello.mn | midnight -    # read from stdin
midnight hello.lua           # .lua files run as Lua
midnight                      # the REPL
```

## Compile

Compile to Lua for distribution:

```sh
midnight compile .            # foo.mn -> foo.lua (in place)
midnight compile src -o out   # ... under out/, keeping paths
midnight -c script.mn         # print the compiled Lua
midnight clean .              # remove generated .lua files
```

## The CLI

| Command | Does |
| --- | --- |
| `midnight script.mn` | run a script |
| `midnight compile` | compile `.mn` to `.lua` |
| `midnight clean` | remove generated `.lua` files |
| `midnight lint` | check for likely mistakes |
| `midnight fmt` | format `.mn` files |

[Next: the language reference →](/reference)
