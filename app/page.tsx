import EditorialBand from "@/components/EditorialBand";
import HeroFeatured from "@/components/HeroFeatured";
import Pagination from "@/components/Pagination";
import SectionRail from "@/components/SectionRail";
import { displayName, stripHtml } from "@/components/editorial";
import { getCategories, getIndex, getNavCategories, getPost, getPostsByCategory } from "@/lib/content";

export const PER_PAGE = 24;

export default function Home() {
  const all = getIndex();
  const categories = getCategories();
  const hero = all[0];
  const secondary = all.slice(1, 4);
  const latest = all.slice(4, 12);
  const heroPost = hero ? getPost(hero.slug) : undefined;
  const rawLead = heroPost ? stripHtml(heroPost.meta_description || heroPost.excerpt.rendered) : "";
  const lead = hero && rawLead.startsWith(hero.title) ? rawLead.slice(hero.title.length).replace(/^[\s:–—-]+/, "") : rawLead;
  const used = new Set<number>([hero?.id, ...secondary.map((post) => post.id), ...latest.map((post) => post.id)].filter((id): id is number => id != null));
  const rails = getNavCategories()
    .slice()
    .sort((a, b) => b.count - a.count)
    .map((category) => ({
      category,
      posts: getPostsByCategory(category.id).filter((post) => !used.has(post.id)).slice(0, 4),
    }))
    .filter((rail) => rail.posts.length > 0)
    .slice(0, 3);

  return (
    <div className="space-y-16 sm:space-y-20">
      <HeroFeatured hero={hero} secondary={secondary} categories={categories} lead={lead || undefined} />
      <SectionRail
        kicker="Νέα"
        title="Τελευταία"
        href="/page/2"
        posts={latest}
        categories={categories}
        layout="feature-list"
        ads
      />
      {rails[0] ? (
        <SectionRail
          kicker="Ενότητα"
          title={displayName(rails[0].category.name)}
          href={`/category/${rails[0].category.slug}`}
          posts={rails[0].posts}
          categories={categories}
          layout="grid"
        />
      ) : null}
      <EditorialBand />
      {rails.slice(1).map((rail, index) => (
        <SectionRail
          key={rail.category.id}
          kicker="Ενότητα"
          title={displayName(rail.category.name)}
          href={`/category/${rail.category.slug}`}
          posts={rail.posts}
          categories={categories}
          layout={index === 0 ? "feature-list" : "grid"}
        />
      ))}
      <Pagination base="" page={1} pages={Math.ceil(all.length / PER_PAGE)} />
    </div>
  );
}
