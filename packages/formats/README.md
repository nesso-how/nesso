# @nesso-how/formats

JSON serialize/deserialize for [Nesso](https://nesso.how) graph files.

## Install

```bash
npm install @nesso-how/formats
```

## Usage

```ts
import { serializeGraph, deserializeGraph } from "@nesso-how/formats";

const json = serializeGraph({ name: "My graph", nodes, edges });
const file = deserializeGraph(json);
```

## License

MIT
