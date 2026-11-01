-- Re-add eligible items from a delivered order to the buyer's current cart.

create or replace function public.reorder_delivered_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_order_status text;
  v_product record;
  v_item record;
  v_existing_quantity integer;
  v_target_quantity integer;
  v_added integer;
  v_added_lines integer := 0;
  v_added_quantity integer := 0;
  v_issues jsonb := '[]'::jsonb;
  v_cart jsonb;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select customer_order.status into v_order_status
  from public.orders customer_order
  where customer_order.id = p_order_id
    and customer_order.user_id = v_user_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  if v_order_status <> 'delivered' then
    raise exception 'REORDER_REQUIRES_DELIVERED_ORDER';
  end if;

  for v_item in
    select item.product_id, item.product_name, item.selected_color, item.quantity
    from public.order_items item
    where item.order_id = p_order_id
    order by item.created_at, item.id
  loop
    select product.id, product.colors, product.stock
    into v_product
    from public.products product
    where product.id = v_item.product_id;

    if not found then
      v_issues := v_issues || jsonb_build_array(jsonb_build_object(
        'productId', v_item.product_id,
        'name', v_item.product_name,
        'reason', 'product_unavailable',
        'requestedQuantity', v_item.quantity,
        'addedQuantity', 0
      ));
      continue;
    end if;

    if v_item.selected_color <> all(v_product.colors) then
      v_issues := v_issues || jsonb_build_array(jsonb_build_object(
        'productId', v_item.product_id,
        'name', v_item.product_name,
        'reason', 'color_unavailable',
        'requestedQuantity', v_item.quantity,
        'addedQuantity', 0
      ));
      continue;
    end if;

    select coalesce((
      select cart.quantity
      from public.cart_items cart
      where cart.user_id = v_user_id
        and cart.product_id = v_item.product_id
        and cart.selected_color = v_item.selected_color
    ), 0) into v_existing_quantity;

    if v_product.stock <= v_existing_quantity then
      v_issues := v_issues || jsonb_build_array(jsonb_build_object(
        'productId', v_item.product_id,
        'name', v_item.product_name,
        'reason', case when v_product.stock <= 0 then 'out_of_stock' else 'cart_at_limit' end,
        'requestedQuantity', v_item.quantity,
        'addedQuantity', 0
      ));
      continue;
    end if;

    v_target_quantity := least(v_product.stock, v_existing_quantity + v_item.quantity);
    v_added := v_target_quantity - v_existing_quantity;

    insert into public.cart_items (
      user_id, product_id, selected_color, quantity
    ) values (
      v_user_id, v_item.product_id, v_item.selected_color, v_target_quantity
    )
    on conflict (user_id, product_id, selected_color)
    do update set quantity = excluded.quantity;

    v_added_lines := v_added_lines + 1;
    v_added_quantity := v_added_quantity + v_added;

    if v_added < v_item.quantity then
      v_issues := v_issues || jsonb_build_array(jsonb_build_object(
        'productId', v_item.product_id,
        'name', v_item.product_name,
        'reason', 'quantity_limited',
        'requestedQuantity', v_item.quantity,
        'addedQuantity', v_added
      ));
    end if;
  end loop;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'productId', cart.product_id,
        'selectedColor', cart.selected_color,
        'quantity', cart.quantity
      ) order by cart.created_at
    ),
    '[]'::jsonb
  ) into v_cart
  from public.cart_items cart
  where cart.user_id = v_user_id;

  return jsonb_build_object(
    'addedLines', v_added_lines,
    'addedQuantity', v_added_quantity,
    'issues', v_issues,
    'cart', v_cart
  );
end;
$$;

revoke all on function public.reorder_delivered_order(uuid) from public, anon;
grant execute on function public.reorder_delivered_order(uuid) to authenticated;
