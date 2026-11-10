import { Fragment, useState } from 'react';
import Header from '../components/Header';
import { ChevronDownIcon, ChevronRightIcon } from '../components/icons';
import { ALL_CATEGORIES, categorySummary, performanceSuppliers, productCategories, scopeView, type PerfScores } from '../data/performance';
import { suppliers as supplierDirectory } from '../data/suppliers';
import { useNavigation } from '../NavigationContext';
import { Badge, Button, Card, CardBody, CardHeader, ColumnChart, EmptyState, Eyebrow, Grid, HeadRow, KpiCard, KpiGrid, Page, PageContent, ProgressBar, SegmentedControl, Select, Table, TableContainer, Td, Tr, cx, toneText, type Tone } from '../components/ui';

const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];

type BenchmarkView = 'supplier' | 'product';

const signed = (value: number) => (value > 0 ? `+${value}` : `${value}`);

const bands: { label: string; cell: string; swatch: string }[] = [
  { label: '≥90', cell: 'bg-success-50 text-success-700', swatch: 'bg-success-200' },
  { label: '75–89', cell: 'bg-info-50 text-info-700', swatch: 'bg-info-200' },
  { label: '60–74', cell: 'bg-warning-50 text-warning-700', swatch: 'bg-warning-200' },
  { label: '<60', cell: 'bg-danger-50 text-danger-700', swatch: 'bg-danger-200' },
];

function ScoreBar({ value, target, label }: { value: number; target: number; label: string }) {
  const tone: Tone = value >= target ? 'success' : value >= target - 10 ? 'warning' : 'danger';
  return (
    <div className="flex items-center gap-3">
      <ProgressBar value={value} target={target} tone={tone} size="md" label={`${label} score, target ${target}%`} className="flex-1" />
      <span className="w-10 text-right text-caption font-semibold tabular-nums text-ink">{value}%</span>
    </div>
  );
}

function Cell({ v }: { v: number }) {
  const band = v >= 90 ? bands[0] : v >= 75 ? bands[1] : v >= 60 ? bands[2] : bands[3];
  return <Td className={cx('text-center text-caption font-semibold tabular-nums', band.cell)}>{v}%</Td>;
}

function ScoreCells({ row }: { row: PerfScores }) {
  return (
    <>
      <Cell v={row.score} />
      <Cell v={row.delivery} />
      <Cell v={row.quality} />
      <Cell v={row.cost} />
      <Cell v={row.resp} />
    </>
  );
}

function ScoreAction({ score }: { score: number }) {
  const { navigate } = useNavigation();
  if (score < 65) return <Button size="xs" variant="danger-soft" onClick={() => navigate('car')}>Create CAR</Button>;
  if (score < 80) return <Button size="xs" variant="warning-soft" onClick={() => navigate('relationship')}>Schedule Review</Button>;
  return null;
}

export default function Performance() {
  const { openSupplier } = useNavigation();
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [view, setView] = useState<BenchmarkView>('supplier');
  const [expanded, setExpanded] = useState<string[]>([]);
  const openSupplierByName = (name: string) => {
    const supplier = supplierDirectory.find(item => item.name.startsWith(name) || name.startsWith(item.name.split(' ')[0]));
    if (supplier) openSupplier(supplier, 'Performance');
  };

  const isAll = category === ALL_CATEGORIES;
  const scope = scopeView(category);
  const inScope = performanceSuppliers.filter(supplier => isAll || supplier.category === category);
  const productRows = inScope
    .flatMap(supplier => supplier.products.map(product => ({ ...product, supplier: supplier.name, category: supplier.category })))
    .sort((a, b) => b.score - a.score);
  const topSupplier = [...inScope].sort((a, b) => b.score - a.score)[0];
  const allExpanded = expanded.length === inScope.length;
  const toggle = (name: string) => setExpanded(current => (current.includes(name) ? current.filter(item => item !== name) : [...current, name]));

  return (
    <Page>
      <Header breadcrumb={['Monitor']} title="Supplier Performance" />
      <PageContent>

        <Card className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
          <Eyebrow>Product category</Eyebrow>
          <div className="flex flex-wrap gap-2">
            {[ALL_CATEGORIES, ...productCategories].map(item => {
              const active = item === category;
              const count = item === ALL_CATEGORIES ? performanceSuppliers.length : performanceSuppliers.filter(supplier => supplier.category === item).length;
              return (
                <Button key={item} variant={active ? 'primary' : 'secondary'} aria-pressed={active} onClick={() => setCategory(item)}>
                  {item}
                  <span className={cx('tabular-nums', active ? 'text-white/70' : 'text-ink-muted')}>{count}</span>
                </Button>
              );
            })}
          </div>
          <span className="text-caption text-ink-muted max-xl:basis-full xl:ml-auto">Scorecards, trend and benchmarking follow the selected category.</span>
        </Card>

        <KpiGrid cols={4}>
          <KpiCard label={isAll ? 'Portfolio score' : `${category} score`} value={`${scope.overall.toFixed(1)}%`} note="Weighted across KPIs" tone="brand" size="md" />
          <KpiCard label="Suppliers scored" value={inScope.length} note={isAll ? 'All categories' : category} size="md" />
          <KpiCard label="Below 65%" value={inScope.filter(supplier => supplier.score < 65).length} note="Candidates for a CAR" tone={inScope.some(supplier => supplier.score < 65) ? 'danger' : 'success'} size="md" />
          <KpiCard label="Top performer" value={topSupplier?.name ?? '—'} note={topSupplier ? `${topSupplier.score}% overall` : 'No suppliers in scope'} tone="success" size="md" />
        </KpiGrid>

        <Grid cols="split3">
          {/* KPI Scorecards */}
          <Card className="xl:col-span-2">
            <CardHeader
              title={`KPI Scorecards — ${isAll ? 'Portfolio Average' : category}`}
              actions={
                <Select size="sm" aria-label="Reporting period" defaultValue="Q3 2024">
                  <option>Q3 2024</option><option>Q2 2024</option><option>Q1 2024</option>
                </Select>
              }
            />
            <CardBody>
              <div className="space-y-5">
                {scope.kpis.map(k => (
                  <div key={k.label}>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-body font-medium text-ink">{k.label}</span>
                      <div className="flex items-center gap-3">
                        <span className={cx('text-caption font-medium', k.delta > 0 ? 'text-success-700' : k.delta < 0 ? 'text-danger-700' : 'text-ink-muted')}>{signed(k.delta)}% vs prev</span>
                        <span className="text-caption text-ink-muted">Target: {k.target}%</span>
                      </div>
                    </div>
                    <ScoreBar value={k.score} target={k.target} label={k.label} />
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-line-subtle pt-4">
                <span className="text-caption text-ink-muted">{isAll ? 'Overall Portfolio Score' : `Overall ${category} Score`}</span>
                <div className="flex items-center gap-3">
                  <ProgressBar value={scope.overall} size="md" label="Overall score" className="w-28" />
                  <span className="text-sm font-semibold tabular-nums text-ink">{scope.overall.toFixed(1)}%</span>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Trend chart */}
          <Card>
            <CardHeader title="Performance Trend" description={`${isAll ? 'Overall avg' : category}, last 6 months`} />
            <CardBody>
              <ColumnChart values={scope.trend} labels={months} unit="%" showValues height={128} ariaLabel="Overall performance trend" />
              <dl className="mt-4 space-y-2 border-t border-line-subtle pt-4">
                {[['On Target', `${scope.mix[0]}%`, 'success'], ['Below Target', `${scope.mix[1]}%`, 'warning'], ['Critical', `${scope.mix[2]}%`, 'danger']].map(([label, value, tone]) => (
                  <div key={label} className="flex justify-between text-caption">
                    <dt className="text-ink-muted">{label}</dt>
                    <dd className={cx('font-semibold', toneText[tone as Tone])}>{value}</dd>
                  </div>
                ))}
              </dl>
            </CardBody>
          </Card>
        </Grid>

        {/* Category comparison */}
        <Card className="overflow-hidden">
          <CardHeader title="Performance by product category" description="Select a category to filter the scorecards and benchmarking below" />
          <TableContainer>
            <Table minWidth={900}>
              <HeadRow columns={['Product category', 'Suppliers', 'Products', 'Overall', 'Delivery', 'Quality', 'Cost', 'Responsiveness', 'Trend (6 mo)', '']} />
              <tbody>
                {productCategories.map(item => {
                  const summary = categorySummary(item);
                  const active = item === category;
                  return (
                    <Tr key={item} onClick={() => setCategory(active ? ALL_CATEGORIES : item)} className={active ? 'bg-brand-50/60' : ''}>
                      <Td className="font-medium text-ink">{item}</Td>
                      <Td className="tabular-nums">{summary.suppliers}</Td>
                      <Td className="tabular-nums">{summary.products}</Td>
                      <ScoreCells row={summary} />
                      <Td className={cx('whitespace-nowrap font-medium tabular-nums', summary.trendDelta > 0 ? 'text-success-700' : summary.trendDelta < 0 ? 'text-danger-700' : 'text-ink-muted')}>{signed(summary.trendDelta)} pts</Td>
                      <Td>{active ? <Badge tone="brand" small>Filtered</Badge> : <Button variant="link" onClick={() => setCategory(item)}>View products</Button>}</Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableContainer>
        </Card>

        {/* Benchmarking table */}
        <Card className="overflow-hidden">
          <CardHeader
            title={view === 'supplier' ? 'Supplier Benchmarking' : 'Product Benchmarking'}
            description={`${isAll ? 'All categories' : category} · ${view === 'supplier' ? `${inScope.length} suppliers` : `${productRows.length} products`}`}
            actions={
              <>
                <SegmentedControl
                  label="Benchmark view"
                  value={view}
                  onChange={setView}
                  items={[{ value: 'supplier', label: 'By supplier' }, { value: 'product', label: 'By product' }]}
                />
                <Button variant="primary">+ New Review</Button>
              </>
            }
          />
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-subtle px-5 py-2.5">
            {view === 'supplier'
              ? <Button variant="link" onClick={() => setExpanded(allExpanded ? [] : inScope.map(supplier => supplier.name))}>{allExpanded ? 'Collapse all products' : 'Expand all products'}</Button>
              : <span className="text-caption text-ink-muted">Sorted by overall score</span>}
            <div className="flex flex-wrap items-center gap-3 text-caption text-ink-muted">
              {bands.map(band => (
                <div key={band.label} className="flex items-center gap-1.5"><div aria-hidden="true" className={cx('h-3 w-3 rounded-sm', band.swatch)} />{band.label}</div>
              ))}
            </div>
          </div>
          <TableContainer>
            {view === 'supplier' ? (
              <Table minWidth={900}>
                <HeadRow columns={['Supplier', 'Category', 'Overall', 'Delivery', 'Quality', 'Cost', 'Responsiveness', 'Action']} />
                <tbody>
                  {inScope.map(supplier => {
                    const open = expanded.includes(supplier.name);
                    return (
                      <Fragment key={supplier.name}>
                        <Tr>
                          <Td>
                            <div className="flex items-center gap-2">
                              <button type="button" aria-expanded={open} aria-label={`${open ? 'Hide' : 'Show'} products of ${supplier.name}`} onClick={() => toggle(supplier.name)} className="rounded-sm p-0.5 text-ink-muted transition-colors hover:bg-sunken hover:text-ink">
                                {open ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
                              </button>
                              <div>
                                <Button variant="inline" size="md" onClick={() => openSupplierByName(supplier.name)}>{supplier.name}</Button>
                                <div className="text-caption text-ink-muted">{supplier.products.length} products</div>
                              </div>
                            </div>
                          </Td>
                          <Td className="text-ink-muted">{supplier.category}</Td>
                          <ScoreCells row={supplier} />
                          <Td><ScoreAction score={supplier.score} /></Td>
                        </Tr>
                        {open && supplier.products.map(product => (
                          <Tr key={`${supplier.name}-${product.name}`} className="bg-canvas/70">
                            <Td className="pl-11 text-ink-soft">{product.name}</Td>
                            <Td className="text-ink-muted">{supplier.category}</Td>
                            <ScoreCells row={product} />
                            <Td><ScoreAction score={product.score} /></Td>
                          </Tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </tbody>
              </Table>
            ) : (
              <Table minWidth={900}>
                <HeadRow columns={['Product', 'Supplier', 'Category', 'Overall', 'Delivery', 'Quality', 'Cost', 'Responsiveness', 'Action']} />
                <tbody>
                  {productRows.map(product => (
                    <Tr key={`${product.supplier}-${product.name}`}>
                      <Td className="font-medium text-ink">{product.name}</Td>
                      <Td><Button variant="inline" size="md" onClick={() => openSupplierByName(product.supplier)}>{product.supplier}</Button></Td>
                      <Td className="text-ink-muted">{product.category}</Td>
                      <ScoreCells row={product} />
                      <Td><ScoreAction score={product.score} /></Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </TableContainer>
          {inScope.length === 0 && <EmptyState title="No suppliers in this category" />}
        </Card>
      </PageContent>
    </Page>
  );
}
