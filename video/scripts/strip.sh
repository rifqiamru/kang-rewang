#!/usr/bin/env bash
# Render beberapa still (detik absolut) lalu gabung jadi satu strip PNG.
# Pemakaian: scripts/strip.sh <output.png> t1 t2 ...
out=$1; shift
B=${REMOTION_BROWSER:+--browser-executable=$REMOTION_BROWSER}
inputs=(); 
mkdir -p out/stills
for t in "$@"; do
  f=$(python3 -c "print(round($t*30))")
  npx remotion still MarketingEvolution out/stills/t$t.png --frame=$f $B --log=error
  inputs+=(-i out/stills/t$t.png)
done
ffmpeg -loglevel error -y "${inputs[@]}" -filter_complex "hstack=$#,scale=$((300*$#)):-1" "$out"
