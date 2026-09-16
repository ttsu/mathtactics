// Shop screen (task 20): five fixed-position offer cards, wallet, owned-tiles strip, and
// ▶ *Next wave*. Icon-led; no sentences. Purchase pops and counts the wallet down; an
// unaffordable tap shakes and flashes the price. NEW stickers come from `AppState.shopNew`.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { ShopOffer, TileId } from '../../sim/core/types';
import { MIN_TOUCH_TARGET } from '../state/designSpace';
import { shopCardStatus } from '../state/shopCard';
import { buyOffer, leaveShopToNextWave, shopOffers } from '../state/shopFlow';
import { tileFace } from '../state/tileFace';
import { CoinStack } from './CoinStack';
import { CannonIcon, CheckIcon, PlayIcon } from './icons';
import { useAppStore, useAppStoreApi } from './StoreContext';
import { TileFaceChip } from './TileFaceChip';

function useCountingNumber(value: number, durationMs: number): number {
  const [shown, setShown] = useState(value);
  const shownRef = useRef(shown);
  shownRef.current = shown;
  useEffect(() => {
    const from = shownRef.current;
    if (from === value || durationMs <= 0) {
      setShown(value);
      return;
    }
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / durationMs);
      const next = Math.round(from + (value - from) * t);
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, durationMs]);
  return shown;
}

function ownedTileIds(tray: string[], cells: (string | null)[][], pieces: Record<string, { tileId: TileId }>): TileId[] {
  const ids: TileId[] = [];
  for (const pieceId of tray) {
    const piece = pieces[pieceId];
    if (piece) ids.push(piece.tileId);
  }
  for (const row of cells) {
    for (const pieceId of row) {
      if (pieceId === null) continue;
      const piece = pieces[pieceId];
      if (piece) ids.push(piece.tileId);
    }
  }
  return ids;
}

function ShopOfferCard({
  offer,
  index,
  coins,
  colors,
  ownedCannons,
  cannonBaseValue,
  maxCannons,
  isNew,
  staggerMs,
}: {
  offer: ShopOffer;
  index: number;
  coins: number;
  colors: Record<'green' | 'blue' | 'orange', string>;
  ownedCannons: number;
  cannonBaseValue: number;
  maxCannons: number;
  isNew: boolean;
  staggerMs: number;
}) {
  const store = useAppStoreApi();
  const status = shopCardStatus(offer, coins);
  const inert = status === 'bought' || status === 'unavailable';
  const [refusing, setRefusing] = useState(false);
  const [popping, setPopping] = useState(false);

  const onTap = () => {
    if (inert) return;
    const result = buyOffer(store, offer.slot);
    if (!result.ok) {
      if (result.error === 'insufficient_coins') setRefusing(true);
      return;
    }
    setPopping(true);
  };

  return (
    <button
      type="button"
      className={[
        'shop-card',
        `shop-card-${status}`,
        refusing ? 'is-refusing' : '',
        popping ? 'is-buying' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-testid={`shop-offer-${offer.slot}`}
      disabled={inert}
      aria-label={offer.kind}
      style={
        {
          minWidth: MIN_TOUCH_TARGET,
          minHeight: MIN_TOUCH_TARGET,
          animationDelay: `${index * staggerMs}ms`,
        } as CSSProperties
      }
      onClick={onTap}
      onAnimationEnd={(event) => {
        if (event.currentTarget !== event.target) return;
        if (event.animationName === 'shop-shake') setRefusing(false);
        if (event.animationName === 'shop-purchase-pop') setPopping(false);
      }}
    >
      {isNew && (
        <span className="shop-new" data-testid={`shop-new-${offer.slot}`}>
          NEW
        </span>
      )}
      {status === 'bought' && (
        <span className="shop-tick" aria-hidden="true">
          <CheckIcon size={36} />
        </span>
      )}
      {offer.kind === 'tile' && <TileOfferFace tileId={offer.tileId} colors={colors} />}
      {offer.kind === 'cannon' && <CannonOfferFace owned={ownedCannons} max={maxCannons} />}
      {offer.kind === 'upgrade' && (
        <UpgradeOfferFace from={cannonBaseValue} to={cannonBaseValue + 1} />
      )}
      <span className={['shop-price', refusing ? 'is-flashing' : ''].filter(Boolean).join(' ')}>
        {offer.price}
        <CoinStack size={28} />
      </span>
    </button>
  );
}

function TileOfferFace({
  tileId,
  colors,
}: {
  tileId: TileId;
  colors: Record<'green' | 'blue' | 'orange', string>;
}) {
  const face = tileFace(tileId);
  return (
    <span className="shop-tile-face" style={{ background: colors[face.colorKey] }}>
      <span className="shop-tile-op">{face.glyph}</span>
      <span className="shop-tile-n">{face.n}</span>
      {face.starred && <span className="shop-tile-star">★</span>}
    </span>
  );
}

function CannonOfferFace({ owned, max }: { owned: number; max: number }) {
  return (
    <span className="shop-cannon-face">
      <CannonIcon size={72} />
      <span className="shop-pips" data-testid="shop-cannon-pips">
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className={i < owned ? 'shop-pip is-filled' : 'shop-pip'} />
        ))}
      </span>
    </span>
  );
}

function UpgradeOfferFace({ from, to }: { from: number; to: number }) {
  return (
    <span className="shop-upgrade-face">
      <CannonIcon size={56} />
      <span className="shop-upgrade-values">
        {from} → {to}
      </span>
    </span>
  );
}

export function ShopScreen() {
  const store = useAppStoreApi();
  const coins = useAppStore((state) => state.display.coins);
  const offers = useAppStore((state) => shopOffers(state.run));
  const shopNew = useAppStore((state) => state.shopNew);
  const colors = useAppStore((state) => state.data.presentation.tileColors);
  const screens = useAppStore((state) => state.data.presentation.screens);
  const maxCannons = useAppStore((state) => state.data.economy.maxCannons);
  const cannons = useAppStore((state) => state.run?.board.cannons);
  const cannonBaseValue = useAppStore((state) => state.run?.cannonBaseValue ?? 1);
  const tray = useAppStore((state) => state.run?.tray);
  const cells = useAppStore((state) => state.run?.board.cells);
  const pieces = useAppStore((state) => state.run?.pieces);
  const ownedCannons = cannons?.filter(Boolean).length ?? 0;
  const owned = ownedTileIds(tray ?? [], cells ?? [], pieces ?? {});
  const shownCoins = useCountingNumber(coins, screens.shopWalletCountMs);
  const newSet = new Set(shopNew);

  return (
    <div
      className="screen shop-screen"
      data-testid="shop"
      style={
        {
          '--pop-in-ms': `${screens.popInMs}ms`,
          '--shop-purchase-pop-ms': `${screens.shopPurchasePopMs}ms`,
          '--shop-refusal-shake-ms': `${screens.shopRefusalShakeMs}ms`,
          '--shop-new-pop-ms': `${screens.shopNewPopMs}ms`,
        } as CSSProperties
      }
    >
      <div className="shop-wallet" data-testid="shop-wallet">
        <span className="shop-wallet-n">{shownCoins}</span>
        <CoinStack size={56} />
      </div>
      <div className="shop-cards">
        {offers.map((offer, index) => (
          <ShopOfferCard
            key={offer.slot}
            offer={offer}
            index={index}
            coins={coins}
            colors={colors}
            ownedCannons={ownedCannons}
            cannonBaseValue={cannonBaseValue}
            maxCannons={maxCannons}
            isNew={offer.kind === 'tile' && newSet.has(offer.tileId)}
            staggerMs={screens.shopCardStaggerMs}
          />
        ))}
      </div>
      <div className="shop-owned" data-testid="shop-owned">
        {owned.map((tileId, index) => (
          <TileFaceChip key={`${tileId}-${index}`} tileId={tileId} colors={colors} />
        ))}
      </div>
      <button
        type="button"
        className="big-button pop-in shop-next"
        data-testid="shop-next"
        aria-label="Next wave"
        onClick={() => leaveShopToNextWave(store)}
      >
        <PlayIcon size={72} />
        <span className="button-label">Next wave</span>
      </button>
    </div>
  );
}
