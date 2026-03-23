## Step 1: Scraping Schedule of Classes

Scraping is done in [SheepTester/uxdy](https://github.com/SheepTester/uxdy/).
`deno task scheduleofclasses:scrape` uses the `TERM` environment variable to scrape the given term to scheduleofclasses/terms/.

```sh
for y in {1995..2026}; do yy="${y:2:2}"; for q in WI SP SU S1 S2 S3 FA; do TERM="${q}${yy}"; [[ "$TERM" =~ ^(S295|S296)$ ]] && continue; [ -f "./scheduleofclasses/terms/${TERM}.json" ] && continue; TERM=$TERM deno task scheduleofclasses:scrape; done; done
```

## Step 2: Generating files

Run in this folder:

```sh
node gen.mts
```

## Step 3: Checking that TOML files are valid

```sh
cargo run
```
