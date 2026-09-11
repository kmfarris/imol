# IMOL v0 Specification

IMOL is a language for LLM-authored programs and tool orchestration. Canonical formatted source is the IR.

## Module

```
module <name> [@id("uuid")]...
<imports>
<workshop>? 
<tools>*
<types>*
<functions>*
```

## Workshop

```
workshop
  allow_net true|false
  bind <module.path>
end
```

## Tools

```
tool <name> from <extern.key> [@io|@net|@pure]...
  { field: Type, ... } -> <output Type>
```

`invoke <name> { field: expr, ... }` calls a declared tool. The checker validates fields against the tool input record.

## Types

- Builtins: `Unit`, `Bool`, `Int`, `Text`
- Records: `{ a: Text, b: Int }`
- Sums: `Ok Text | Err Text`
- Aliases: `type Result = Ok Text | Err Text`

No implicit casts.

## Effects

Function and tool attributes: `@pure`, `@io`, `@net`, `@unsafe`. A function may only perform effects listed on its attributes.

## Holes

`hole name "reason"` marks intentional incompleteness. Execution is rejected unless `imol check --allow-holes`.

## CLI

- `imol check file.imol`
- `imol fmt file.imol [--write]`
- `imol run file.imol`
- `imol workshop file.imol [--dry-run]`
