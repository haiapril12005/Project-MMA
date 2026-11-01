-- Replaces every catalog image with a verified, product-relevant Pexels photo.
-- Only image_url is updated; accounts, carts and orders are untouched.
begin;

update public.products as product
set image_url = source.image_url
from (values
  (1, 'https://images.pexels.com/photos/16021300/pexels-photo-16021300.jpeg?auto=compress&cs=tinysrgb&w=800'),
  (2, 'https://images.pexels.com/photos/6587826/pexels-photo-6587826.jpeg?auto=compress&cs=tinysrgb&w=800'),
  (3, 'https://images.pexels.com/photos/31206787/pexels-photo-31206787.jpeg?auto=compress&cs=tinysrgb&w=800'),
  (4, 'https://images.pexels.com/photos/298542/pexels-photo-298542.jpeg?auto=compress&cs=tinysrgb&w=800'),
  (5, 'https://images.pexels.com/photos/15857173/pexels-photo-15857173.jpeg?auto=compress&cs=tinysrgb&w=800'),
  (6, 'https://images.pexels.com/photos/6134886/pexels-photo-6134886.jpeg?auto=compress&cs=tinysrgb&w=800'),
  (7, 'https://images.pexels.com/photos/10931479/pexels-photo-10931479.jpeg?auto=compress&cs=tinysrgb&w=800'),
  (8, 'https://images.pexels.com/photos/12128458/pexels-photo-12128458.jpeg?auto=compress&cs=tinysrgb&w=800'),
  (9, 'https://images.pexels.com/photos/5824901/pexels-photo-5824901.jpeg?auto=compress&cs=tinysrgb&w=800'),
  (10, 'https://images.pexels.com/photos/5490303/pexels-photo-5490303.jpeg?auto=compress&cs=tinysrgb&w=800'),
  (11, 'https://images.pexels.com/photos/5825564/pexels-photo-5825564.jpeg?auto=compress&cs=tinysrgb&w=800'),
  (12, 'https://images.pexels.com/photos/12497935/pexels-photo-12497935.jpeg?auto=compress&cs=tinysrgb&w=800'),
  (13, 'https://images.pexels.com/photos/19966810/pexels-photo-19966810.jpeg?auto=compress&cs=tinysrgb&w=800'),
  (14, 'https://images.pexels.com/photos/31594915/pexels-photo-31594915.jpeg?auto=compress&cs=tinysrgb&w=800'),
  (15, 'https://images.pexels.com/photos/12284838/pexels-photo-12284838.jpeg?auto=compress&cs=tinysrgb&w=800'),
  (16, 'https://images.pexels.com/photos/17264276/pexels-photo-17264276.jpeg?auto=compress&cs=tinysrgb&w=800'),
  (17, 'https://images.pexels.com/photos/19862426/pexels-photo-19862426.jpeg?auto=compress&cs=tinysrgb&w=800'),
  (18, 'https://images.pexels.com/photos/7193628/pexels-photo-7193628.jpeg?auto=compress&cs=tinysrgb&w=800'),
  (19, 'https://images.pexels.com/photos/35108893/pexels-photo-35108893.jpeg?auto=compress&cs=tinysrgb&w=800'),
  (20, 'https://images.pexels.com/photos/8251244/pexels-photo-8251244.jpeg?auto=compress&cs=tinysrgb&w=800'),
  (21, 'https://images.pexels.com/photos/17919765/pexels-photo-17919765.jpeg?auto=compress&cs=tinysrgb&w=800'),
  (22, 'https://images.pexels.com/photos/8986694/pexels-photo-8986694.jpeg?auto=compress&cs=tinysrgb&w=800'),
  (23, 'https://images.pexels.com/photos/18447738/pexels-photo-18447738.jpeg?auto=compress&cs=tinysrgb&w=800'),
  (24, 'https://images.pexels.com/photos/33120248/pexels-photo-33120248.jpeg?auto=compress&cs=tinysrgb&w=800'),
  (25, 'https://images.pexels.com/photos/4800180/pexels-photo-4800180.jpeg?auto=compress&cs=tinysrgb&w=800'),
  (26, 'https://images.pexels.com/photos/22702955/pexels-photo-22702955.jpeg?auto=compress&cs=tinysrgb&w=800'),
  (27, 'https://images.pexels.com/photos/39854860/pexels-photo-39854860.jpeg?auto=compress&cs=tinysrgb&w=800'),
  (28, 'https://images.pexels.com/photos/8186472/pexels-photo-8186472.jpeg?auto=compress&cs=tinysrgb&w=800'),
  (29, 'https://images.pexels.com/photos/4469144/pexels-photo-4469144.jpeg?auto=compress&cs=tinysrgb&w=800'),
  (30, 'https://images.pexels.com/photos/15629643/pexels-photo-15629643.jpeg?auto=compress&cs=tinysrgb&w=800'),
  (31, 'https://images.pexels.com/photos/7195590/pexels-photo-7195590.jpeg?auto=compress&cs=tinysrgb&w=800'),
  (32, 'https://images.pexels.com/photos/18781214/pexels-photo-18781214.jpeg?auto=compress&cs=tinysrgb&w=800'),
  (33, 'https://images.pexels.com/photos/9696590/pexels-photo-9696590.jpeg?auto=compress&cs=tinysrgb&w=800'),
  (34, 'https://images.pexels.com/photos/35014602/pexels-photo-35014602.jpeg?auto=compress&cs=tinysrgb&w=800'),
  (35, 'https://images.pexels.com/photos/4846295/pexels-photo-4846295.jpeg?auto=compress&cs=tinysrgb&w=800'),
  (36, 'https://images.pexels.com/photos/7936636/pexels-photo-7936636.jpeg?auto=compress&cs=tinysrgb&w=800'),
  (37, 'https://images.pexels.com/photos/35747335/pexels-photo-35747335.jpeg?auto=compress&cs=tinysrgb&w=800'),
  (38, 'https://images.pexels.com/photos/7787208/pexels-photo-7787208.jpeg?auto=compress&cs=tinysrgb&w=800'),
  (39, 'https://images.pexels.com/photos/13096241/pexels-photo-13096241.jpeg?auto=compress&cs=tinysrgb&w=800'),
  (40, 'https://images.pexels.com/photos/37108938/pexels-photo-37108938.jpeg?auto=compress&cs=tinysrgb&w=800')
) as source(id, image_url)
where product.id = source.id;

commit;
